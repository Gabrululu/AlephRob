# { "Depends": "py-genlayer:test" }

# AlephRob Protocol — ReputationLedger
# Sistema de reputación peer-to-peer entre agentes robóticos.
# Cualquier agente registrado puede reportar el rendimiento de otro.
# El LLM evalúa si el reporte es legítimo y justo antes de aplicar cambios.
# Considera: calidad del resultado, condiciones del entorno, tiempo, historial.

from dataclasses import dataclass
from genlayer import *

AGENT_REGISTRY = "0xf39101cB9A2CD4224d0143f812B9c6CB012edDAe"
MISSION_FACTORY = "0xfdca4ab91E9c49f4f466F47F5adB9e34B3Eb5Ed6"

REPORT_OUTCOMES = ["SUCCESS", "PARTIAL", "FAILURE"]


@allow_storage
@dataclass
class PerformanceReport:
    report_id: str
    reporter_agent: str      # quien reporta
    target_agent: str        # a quien reportan
    mission_id: str
    task_id: str
    outcome: str             # SUCCESS | PARTIAL | FAILURE
    result_quality: str      # descripción de la calidad del resultado
    execution_time: str      # tiempo real vs esperado
    environment_notes: str   # condiciones del entorno
    reporter_address: str
    reputation_delta: i32    # cambio aplicado (puede ser negativo)
    llm_verdict: str         # justificación del LLM
    accepted: bool           # si el LLM aceptó el reporte


@allow_storage
@dataclass
class AgentReputation:
    agent_id: str
    current_score: u256
    total_reports: u256
    reports_accepted: u256
    reports_rejected: u256
    best_performance: str    # mejor reporte recibido
    worst_performance: str   # peor reporte recibido


class ReputationLedger(gl.Contract):
    reports: TreeMap[str, PerformanceReport]
    agent_reputations: TreeMap[str, AgentReputation]
    agent_reports_received: TreeMap[str, DynArray[str]]  # agent_id → [report_ids]
    total_reports: u256
    total_accepted: u256

    def __init__(self):
        self.total_reports = u256(0)
        self.total_accepted = u256(0)

    def _evaluate_report(
        self,
        reporter_agent: str,
        target_agent: str,
        outcome: str,
        result_quality: str,
        execution_time: str,
        environment_notes: str,
        target_history: str,
    ) -> dict:
        """
        El LLM evalúa si el reporte es legítimo y calcula el delta de reputación.
        Considera los 4 factores: calidad, entorno, tiempo e historial.
        """
        def get_verdict() -> str:
            task = f"""You are the AlephRob Protocol reputation arbiter for autonomous robotic agents on Mars.

A performance report has been submitted by one robotic agent about another:

Reporter agent: {reporter_agent}
Target agent: {target_agent}
Mission outcome declared: {outcome}
Result quality description: {result_quality}
Execution time notes: {execution_time}
Environmental conditions: {environment_notes}
Target agent historical performance: {target_history}

Evaluate this report considering all 4 factors:
1. RESULT QUALITY: Was the delivered result complete, accurate, and useful? (weight: 40%)
2. ENVIRONMENTAL CONDITIONS: Were there difficult terrain, distance, or atmospheric factors that should adjust the score? (weight: 25%)
3. EXECUTION TIME: Was the task completed in reasonable time given the conditions? (weight: 20%)
4. HISTORICAL CONTEXT: Does this result align with or deviate from the agent's track record? (weight: 15%)

Also assess: Is this report credible and unbiased? Peer reports can be manipulated.

Rules for reputation delta:
- SUCCESS with excellent quality: +5 to +10
- SUCCESS with acceptable quality: +1 to +4
- PARTIAL completion: -2 to +2 depending on circumstances
- FAILURE with justification (environment): -3 to -8
- FAILURE without justification: -10 to -20
- Suspicious/biased report: delta = 0, mark as rejected

Respond ONLY with a JSON object:
{{"accepted": true, "delta": 7, "new_score_estimate": 77, "verdict": "One sentence justification.", "suspicious": false}}"""

            result = gl.nondet.exec_prompt(task, response_format="json")
            import json
            parsed = json.loads(result) if isinstance(result, str) else result
            accepted = bool(parsed.get("accepted", False))
            suspicious = bool(parsed.get("suspicious", False))
            if suspicious:
                accepted = False
            delta = int(parsed.get("delta", 0))
            if not accepted:
                delta = 0
            new_score = int(parsed.get("new_score_estimate", 50))
            new_score = max(0, min(100, new_score))
            verdict = str(parsed.get("verdict", ""))
            return f'{{"accepted": {str(accepted).lower()}, "delta": {delta}, "new_score": {new_score}, "suspicious": {str(suspicious).lower()}, "verdict": "{verdict}"}}'

        raw = gl.eq_principle.strict_eq(get_verdict)
        import json
        return json.loads(raw)

    @gl.public.write
    def submit_report(
        self,
        report_id: str,
        reporter_agent: str,
        target_agent: str,
        mission_id: str,
        task_id: str,
        outcome: str,
        result_quality: str,
        execution_time: str,
        environment_notes: str,
    ) -> str:
        """
        Cualquier agente puede reportar el rendimiento de otro.
        El LLM valida el reporte y decide si aplicar el cambio de reputación.
        """
        if report_id in self.reports:
            raise Exception(f"Report {report_id} already exists")

        outcome_upper = outcome.upper()
        if outcome_upper not in REPORT_OUTCOMES:
            raise Exception(f"Invalid outcome. Must be one of: {REPORT_OUTCOMES}")

        if reporter_agent == target_agent:
            raise Exception("An agent cannot report itself")

        reporter_address = gl.message.sender_address.as_hex

        # Obtener historial del agente objetivo
        target_history = "No previous reports on record"
        if target_agent in self.agent_reputations:
            rep = self.agent_reputations[target_agent]
            target_history = f"Score: {rep.current_score}/100, Reports received: {rep.total_reports}, Accepted: {rep.reports_accepted}"

        verdict = self._evaluate_report(
            reporter_agent,
            target_agent,
            outcome_upper,
            result_quality,
            execution_time,
            environment_notes,
            target_history,
        )

        self.total_reports += u256(1)

        report = PerformanceReport(
            report_id=report_id,
            reporter_agent=reporter_agent,
            target_agent=target_agent,
            mission_id=mission_id,
            task_id=task_id,
            outcome=outcome_upper,
            result_quality=result_quality,
            execution_time=execution_time,
            environment_notes=environment_notes,
            reporter_address=reporter_address,
            reputation_delta=verdict["delta"],
            llm_verdict=verdict["verdict"],
            accepted=verdict["accepted"],
        )

        self.reports[report_id] = report

        # Inicializar reputación del agente si no existe
        if target_agent not in self.agent_reputations:
            agent_rep = AgentReputation(
                agent_id=target_agent,
                current_score=u256(70),  # score base si no está en registry
                total_reports=u256(0),
                reports_accepted=u256(0),
                reports_rejected=u256(0),
                best_performance="",
                worst_performance="",
            )
            self.agent_reputations[target_agent] = agent_rep
            self.agent_reports_received.get_or_insert_default(target_agent)

        agent_rep = self.agent_reputations[target_agent]
        agent_rep.total_reports += u256(1)
        self.agent_reports_received[target_agent].append(report_id)

        if verdict["accepted"]:
            self.total_accepted += u256(1)
            agent_rep.reports_accepted += u256(1)

            # Aplicar delta — clamp entre 0 y 100
            current = int(agent_rep.current_score)
            new_score = max(0, min(100, current + verdict["delta"]))
            agent_rep.current_score = u256(new_score)

            if verdict["delta"] > 0 and (
                agent_rep.best_performance == "" or
                verdict["delta"] > 5
            ):
                agent_rep.best_performance = f"{outcome_upper} on {task_id}: {verdict['verdict']}"

            if verdict["delta"] < -5:
                agent_rep.worst_performance = f"{outcome_upper} on {task_id}: {verdict['verdict']}"

        else:
            agent_rep.reports_rejected += u256(1)

        self.agent_reputations[target_agent] = agent_rep

        if verdict["accepted"]:
            return f"ACCEPTED: {target_agent} reputation {verdict['delta']:+d} → {int(agent_rep.current_score)}/100. {verdict['verdict']}"
        else:
            return f"REJECTED: Report dismissed as suspicious or insufficient. {verdict['verdict']}"

    @gl.public.view
    def get_agent_reputation(self, agent_id: str) -> dict:
        """Devuelve la reputación completa de un agente."""
        if agent_id not in self.agent_reputations:
            return {
                "agent_id": agent_id,
                "current_score": 0,
                "total_reports": 0,
                "reports_accepted": 0,
                "reports_rejected": 0,
                "best_performance": "",
                "worst_performance": "",
                "status": "no_reports_yet",
            }

        r = self.agent_reputations[agent_id]
        return {
            "agent_id": r.agent_id,
            "current_score": r.current_score,
            "total_reports": r.total_reports,
            "reports_accepted": r.reports_accepted,
            "reports_rejected": r.reports_rejected,
            "best_performance": r.best_performance,
            "worst_performance": r.worst_performance,
        }

    @gl.public.view
    def get_report(self, report_id: str) -> dict:
        """Devuelve un reporte específico."""
        if report_id not in self.reports:
            raise Exception(f"Report {report_id} not found")

        r = self.reports[report_id]
        return {
            "report_id": r.report_id,
            "reporter_agent": r.reporter_agent,
            "target_agent": r.target_agent,
            "mission_id": r.mission_id,
            "task_id": r.task_id,
            "outcome": r.outcome,
            "result_quality": r.result_quality,
            "reputation_delta": r.reputation_delta,
            "llm_verdict": r.llm_verdict,
            "accepted": r.accepted,
        }

    @gl.public.view
    def get_agent_reports(self, agent_id: str) -> list:
        """Lista todos los report_ids recibidos por un agente."""
        if agent_id not in self.agent_reports_received:
            return []
        return list(self.agent_reports_received[agent_id])

    @gl.public.view
    def get_ledger_stats(self) -> dict:
        """Estadísticas globales del ledger."""
        acceptance_rate = 0
        if self.total_reports > u256(0):
            acceptance_rate = int(self.total_accepted) * 100 // int(self.total_reports)
        return {
            "total_reports": self.total_reports,
            "total_accepted": self.total_accepted,
            "acceptance_rate_pct": acceptance_rate,
            "agent_registry": AGENT_REGISTRY,
            "mission_factory": MISSION_FACTORY,
            "protocol": "AlephRob v1.0",
        }