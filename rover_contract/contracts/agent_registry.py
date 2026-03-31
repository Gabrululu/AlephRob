from dataclasses import dataclass
from genlayer import *


VALID_TYPES = ["EXPLORER", "COLLECTOR", "TRANSPORTER", "ANALYST"]
VALID_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"]


@allow_storage
@dataclass
class RoverAgent:
    agent_id: str
    name: str
    rover_type: str          # EXPLORER | COLLECTOR | TRANSPORTER | ANALYST
    capabilities: str        # descripción libre de capacidades
    owner: str               # address del registrador
    reputation: u256         # 0-100, asignado por LLM al registrar
    missions_completed: u256
    missions_failed: u256
    status: str              # ACTIVE | INACTIVE | SUSPENDED
    registration_notes: str  # justificación del LLM al aprobar


class AgentRegistry(gl.Contract):
    agents: TreeMap[str, RoverAgent]         # agent_id → RoverAgent
    owner_agents: TreeMap[str, DynArray[str]] # owner_address → [agent_ids]
    total_registered: u256
    total_active: u256

    def __init__(self):
        self.total_registered = u256(0)
        self.total_active = u256(0)

    def _evaluate_registration(
        self, name: str, rover_type: str, capabilities: str
    ) -> dict:
        """
        El LLM evalúa si el rover merece ser registrado y asigna reputación inicial.
        Devuelve: {"approved": bool, "reputation": int, "notes": str}
        """
        def get_decision() -> str:
            task = f"""You are the AlephRob Protocol registration authority for autonomous robotic agents operating on Mars.

A new robotic agent is requesting registration with the following profile:
- Name: {name}
- Type: {rover_type}
- Declared capabilities: {capabilities}

Evaluate this registration request based on:
1. Does the rover type match one of the valid categories: EXPLORER, COLLECTOR, TRANSPORTER, ANALYST?
2. Are the declared capabilities coherent and realistic for a Mars rover of this type?
3. Do the capabilities justify a deployment in a complex mission environment?

If APPROVED, assign an initial reputation score from 50 to 80 based on:
- 50-59: Basic capabilities, limited complexity
- 60-69: Standard capabilities, adequate for routine missions  
- 70-79: Advanced capabilities, suitable for complex missions
- 80: Exceptional capabilities, elite classification

Respond ONLY with a JSON object in this exact format, nothing else:
{{"approved": true, "reputation": 70, "notes": "Brief justification in one sentence."}}
or
{{"approved": false, "reputation": 0, "notes": "Reason for rejection in one sentence."}}"""

            result = gl.nondet.exec_prompt(task, response_format="json")
            import json
            parsed = json.loads(result) if isinstance(result, str) else result
            approved = bool(parsed.get("approved", False))
            reputation = int(parsed.get("reputation", 0))
            reputation = max(0, min(100, reputation))
            notes = str(parsed.get("notes", ""))
            return f'{{"approved": {str(approved).lower()}, "reputation": {reputation}, "notes": "{notes}"}}'

        raw = gl.eq_principle.strict_eq(get_decision)
        import json
        return json.loads(raw)

    @gl.public.write
    def register_agent(
        self,
        agent_id: str,
        name: str,
        rover_type: str,
        capabilities: str,
    ) -> str:
        """
        Registra un nuevo rover. El LLM evalúa si merece ser registrado
        y asigna su reputación inicial.
        """
        if agent_id in self.agents:
            raise Exception(f"Agent {agent_id} already registered")

        rover_type_upper = rover_type.upper()
        if rover_type_upper not in VALID_TYPES:
            raise Exception(f"Invalid rover type. Must be one of: {VALID_TYPES}")

        evaluation = self._evaluate_registration(name, rover_type_upper, capabilities)

        if not evaluation["approved"]:
            return f"REJECTED: {evaluation['notes']}"

        owner_address = gl.message.sender_address.as_hex

        agent = RoverAgent(
            agent_id=agent_id,
            name=name,
            rover_type=rover_type_upper,
            capabilities=capabilities,
            owner=owner_address,
            reputation=u256(evaluation["reputation"]),
            missions_completed=u256(0),
            missions_failed=u256(0),
            status="ACTIVE",
            registration_notes=evaluation["notes"],
        )

        self.agents[agent_id] = agent

        if owner_address not in self.owner_agents:
            self.owner_agents.get_or_insert_default(owner_address)
        self.owner_agents[owner_address].append(agent_id)

        self.total_registered += u256(1)
        self.total_active += u256(1)

        return f"APPROVED: {agent_id} registered with reputation {evaluation['reputation']}. {evaluation['notes']}"

    @gl.public.write
    def update_reputation(
        self,
        agent_id: str,
        mission_success: bool,
        performance_notes: str,
    ) -> str:
        """
        Actualiza la reputación de un rover después de una misión.
        El LLM evalúa el rendimiento y decide el delta de reputación.
        """
        if agent_id not in self.agents:
            raise Exception(f"Agent {agent_id} not found")

        agent = self.agents[agent_id]
        current_rep = int(agent.reputation)

        def get_delta() -> str:
            outcome = "SUCCESS" if mission_success else "FAILURE"
            task = f"""You are evaluating a Mars rover's mission performance for the AlephRob Protocol.

Rover: {agent.name} (Type: {agent.rover_type})
Current reputation: {current_rep}/100
Mission outcome: {outcome}
Performance notes: {performance_notes}

Based on the mission outcome and performance notes, determine the reputation adjustment.
Rules:
- Success: +1 to +10 points depending on performance quality
- Failure: -5 to -20 points depending on severity
- Never exceed 100 or go below 0
- Be conservative with large adjustments

Respond ONLY with a JSON object:
{{"delta": 5, "new_reputation": 75, "reason": "One sentence explanation."}}"""

            result = gl.nondet.exec_prompt(task, response_format="json")
            import json
            parsed = json.loads(result) if isinstance(result, str) else result
            delta = int(parsed.get("delta", 0))
            new_rep = max(0, min(100, current_rep + delta))
            reason = str(parsed.get("reason", ""))
            return f'{{"delta": {delta}, "new_reputation": {new_rep}, "reason": "{reason}"}}'

        import json
        result = json.loads(gl.eq_principle.strict_eq(get_delta))

        agent.reputation = u256(result["new_reputation"])

        if mission_success:
            agent.missions_completed += u256(1)
        else:
            agent.missions_failed += u256(1)
            if result["new_reputation"] < 20:
                agent.status = "SUSPENDED"
                self.total_active -= u256(1)

        self.agents[agent_id] = agent

        return f"Reputation updated: {current_rep} → {result['new_reputation']} ({result['reason']})"

    @gl.public.write
    def set_status(self, agent_id: str, new_status: str) -> str:
        """Cambia el estado de un rover (solo el owner puede hacerlo)."""
        if agent_id not in self.agents:
            raise Exception(f"Agent {agent_id} not found")

        agent = self.agents[agent_id]
        caller = gl.message.sender_address.as_hex

        if agent.owner != caller:
            raise Exception("Only the agent owner can change its status")

        new_status_upper = new_status.upper()
        if new_status_upper not in VALID_STATUSES:
            raise Exception(f"Invalid status. Must be one of: {VALID_STATUSES}")

        old_status = agent.status

        if old_status == "ACTIVE" and new_status_upper != "ACTIVE":
            self.total_active -= u256(1)
        elif old_status != "ACTIVE" and new_status_upper == "ACTIVE":
            self.total_active += u256(1)

        agent.status = new_status_upper
        self.agents[agent_id] = agent

        return f"Agent {agent_id} status: {old_status} → {new_status_upper}"

    @gl.public.view
    def get_agent(self, agent_id: str) -> dict:
        """Devuelve el perfil completo de un rover."""
        if agent_id not in self.agents:
            raise Exception(f"Agent {agent_id} not found")

        a = self.agents[agent_id]
        return {
            "agent_id": a.agent_id,
            "name": a.name,
            "rover_type": a.rover_type,
            "capabilities": a.capabilities,
            "owner": a.owner,
            "reputation": a.reputation,
            "missions_completed": a.missions_completed,
            "missions_failed": a.missions_failed,
            "status": a.status,
            "registration_notes": a.registration_notes,
        }

    @gl.public.view
    def get_registry_stats(self) -> dict:
        """Devuelve estadísticas globales del registro."""
        return {
            "total_registered": self.total_registered,
            "total_active": self.total_active,
            "protocol": "AlephRob v1.0",
            "network": "Bradbury Testnet",
        }

    @gl.public.view
    def get_agents_by_owner(self, owner_address: str) -> list:
        """Lista todos los rovers registrados por una dirección."""
        if owner_address not in self.owner_agents:
            return []
        return list(self.owner_agents[owner_address])

    @gl.public.view
    def is_eligible(self, agent_id: str, min_reputation: u256) -> bool:
        """
        Verifica si un rover es elegible para una misión
        basado en reputación mínima requerida.
        """
        if agent_id not in self.agents:
            return False
        agent = self.agents[agent_id]
        return agent.status == "ACTIVE" and agent.reputation >= min_reputation