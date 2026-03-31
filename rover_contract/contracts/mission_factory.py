# { "Depends": "py-genlayer:test" }

# AlephRob Protocol — MissionFactory
# Crea y gestiona misiones multi-robot con tareas encadenadas.
# Cada tarea requiere que la anterior esté COMPLETED para poder ejecutarse.
# El LLM valida cada entrega antes de avanzar al siguiente paso.

from dataclasses import dataclass
from genlayer import *

# Address del AgentRegistry deployado en Bradbury
AGENT_REGISTRY = "0xf39101cB9A2CD4224d0143f812B9c6CB012edDAe"

VALID_TASK_TYPES = ["EXPLORE", "COLLECT", "TRANSPORT", "ANALYZE"]
VALID_TASK_STATUS = ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED"]
VALID_MISSION_STATUS = ["ACTIVE", "COMPLETED", "FAILED", "PAUSED"]


@allow_storage
@dataclass
class Task:
    task_id: str
    task_type: str           # EXPLORE | COLLECT | TRANSPORT | ANALYZE
    description: str         # qué debe hacer el robot
    assigned_agent: str      # agent_id del rover asignado
    min_reputation: u256     # reputación mínima para ejecutar
    depends_on: str          # task_id del que depende (vacío = primera tarea)
    status: str              # PENDING | IN_PROGRESS | COMPLETED | FAILED
    result_data: str         # datos del resultado (coordenadas, análisis, etc.)
    validation_notes: str    # justificación del LLM al validar


@allow_storage
@dataclass
class Mission:
    mission_id: str
    name: str
    description: str
    creator: str             # address del creador
    status: str              # ACTIVE | COMPLETED | FAILED | PAUSED
    task_ids: DynArray[str]  # orden de las tareas
    tasks_completed: u256
    tasks_total: u256
    created_at: str          # block number como string


class MissionFactory(gl.Contract):
    missions: TreeMap[str, Mission]
    tasks: TreeMap[str, Task]          # task_id → Task
    total_missions: u256
    total_tasks_validated: u256

    def __init__(self):
        self.total_missions = u256(0)
        self.total_tasks_validated = u256(0)

    def _validate_task_result(
        self,
        task_type: str,
        task_description: str,
        agent_name: str,
        result_data: str,
    ) -> dict:
        """
        El LLM valida si el resultado entregado por el rover cumple con
        los requisitos de la tarea. Usa Equivalence Principle para consenso.
        """
        def get_validation() -> str:
            task = f"""You are the AlephRob Mission Control AI validating a robotic task result on Mars.

Task type: {task_type}
Task description: {task_description}
Executed by: {agent_name}
Result submitted: {result_data}

Validate whether the submitted result satisfactorily completes the task:
1. Does the result match what was required for a {task_type} task?
2. Is the data complete and coherent for a Mars robotic operation?
3. Does it provide sufficient information for the next task in the mission?

Respond ONLY with a JSON object:
{{"approved": true, "confidence": 0.92, "notes": "One sentence validation summary."}}
or
{{"approved": false, "confidence": 0.3, "notes": "One sentence explanation of what is missing."}}"""

            result = gl.nondet.exec_prompt(task, response_format="json")
            import json
            parsed = json.loads(result) if isinstance(result, str) else result
            approved = bool(parsed.get("approved", False))
            confidence = float(parsed.get("confidence", 0.0))
            confidence = max(0.0, min(1.0, confidence))
            notes = str(parsed.get("notes", ""))
            return f'{{"approved": {str(approved).lower()}, "confidence": {confidence:.2f}, "notes": "{notes}"}}'

        raw = gl.eq_principle.strict_eq(get_validation)
        import json
        return json.loads(raw)

    @gl.public.write
    def create_mission(
        self,
        mission_id: str,
        name: str,
        description: str,
    ) -> str:
        """Crea una nueva misión. Las tareas se agregan después."""
        if mission_id in self.missions:
            raise Exception(f"Mission {mission_id} already exists")

        creator = gl.message.sender_address.as_hex

        mission = Mission(
            mission_id=mission_id,
            name=name,
            description=description,
            creator=creator,
            status="ACTIVE",
            task_ids=DynArray[str]([]),
            tasks_completed=u256(0),
            tasks_total=u256(0),
            created_at=str(gl.block_number()),
        )

        self.missions[mission_id] = mission
        self.total_missions += u256(1)

        return f"Mission {mission_id} created: {name}"

    @gl.public.write
    def add_task(
        self,
        mission_id: str,
        task_id: str,
        task_type: str,
        description: str,
        assigned_agent: str,
        min_reputation: u256,
        depends_on: str,
    ) -> str:
        """
        Agrega una tarea a una misión existente.
        depends_on: task_id de la tarea previa (vacío string si es la primera).
        """
        if mission_id not in self.missions:
            raise Exception(f"Mission {mission_id} not found")

        if task_id in self.tasks:
            raise Exception(f"Task {task_id} already exists")

        task_type_upper = task_type.upper()
        if task_type_upper not in VALID_TASK_TYPES:
            raise Exception(f"Invalid task type. Must be one of: {VALID_TASK_TYPES}")

        if depends_on != "" and depends_on not in self.tasks:
            raise Exception(f"Dependency task {depends_on} not found")

        task = Task(
            task_id=task_id,
            task_type=task_type_upper,
            description=description,
            assigned_agent=assigned_agent,
            min_reputation=min_reputation,
            depends_on=depends_on,
            status="PENDING",
            result_data="",
            validation_notes="",
        )

        self.tasks[task_id] = task

        mission = self.missions[mission_id]
        mission.task_ids.append(task_id)
        mission.tasks_total += u256(1)
        self.missions[mission_id] = mission

        return f"Task {task_id} ({task_type_upper}) added to mission {mission_id}"

    @gl.public.write
    def start_task(self, task_id: str) -> str:
        """
        El rover asignado marca la tarea como IN_PROGRESS.
        Verifica que la tarea dependiente esté COMPLETED.
        """
        if task_id not in self.tasks:
            raise Exception(f"Task {task_id} not found")

        task = self.tasks[task_id]

        if task.status != "PENDING":
            raise Exception(f"Task {task_id} is not PENDING (current: {task.status})")

        if task.depends_on != "":
            dep = self.tasks[task.depends_on]
            if dep.status != "COMPLETED":
                raise Exception(
                    f"Dependency {task.depends_on} not completed yet (status: {dep.status})"
                )

        task.status = "IN_PROGRESS"
        self.tasks[task_id] = task

        return f"Task {task_id} is now IN_PROGRESS by {task.assigned_agent}"

    @gl.public.write
    def submit_task_result(
        self,
        mission_id: str,
        task_id: str,
        agent_name: str,
        result_data: str,
    ) -> str:
        """
        El rover envía el resultado de la tarea.
        El LLM valida si el resultado es satisfactorio usando Equivalence Principle.
        Si es aprobado, la tarea pasa a COMPLETED y se desbloquea la siguiente.
        """
        if task_id not in self.tasks:
            raise Exception(f"Task {task_id} not found")

        if mission_id not in self.missions:
            raise Exception(f"Mission {mission_id} not found")

        task = self.tasks[task_id]

        if task.status != "IN_PROGRESS":
            raise Exception(f"Task {task_id} is not IN_PROGRESS")

        validation = self._validate_task_result(
            task.task_type,
            task.description,
            agent_name,
            result_data,
        )

        self.total_tasks_validated += u256(1)

        if validation["approved"]:
            task.status = "COMPLETED"
            task.result_data = result_data
            task.validation_notes = validation["notes"]
            self.tasks[task_id] = task

            mission = self.missions[mission_id]
            mission.tasks_completed += u256(1)

            if mission.tasks_completed >= mission.tasks_total:
                mission.status = "COMPLETED"

            self.missions[mission_id] = mission

            return f"VALIDATED: Task {task_id} completed. {validation['notes']}"
        else:
            task.status = "FAILED"
            task.validation_notes = validation["notes"]
            self.tasks[task_id] = task

            mission = self.missions[mission_id]
            mission.status = "FAILED"
            self.missions[mission_id] = mission

            return f"REJECTED: Task {task_id} failed validation. {validation['notes']}"

    @gl.public.view
    def get_mission(self, mission_id: str) -> dict:
        """Devuelve el estado completo de una misión con todas sus tareas."""
        if mission_id not in self.missions:
            raise Exception(f"Mission {mission_id} not found")

        m = self.missions[mission_id]
        tasks_detail = []

        for tid in m.task_ids:
            if tid in self.tasks:
                t = self.tasks[tid]
                tasks_detail.append({
                    "task_id": t.task_id,
                    "task_type": t.task_type,
                    "description": t.description,
                    "assigned_agent": t.assigned_agent,
                    "min_reputation": t.min_reputation,
                    "depends_on": t.depends_on,
                    "status": t.status,
                    "result_data": t.result_data,
                    "validation_notes": t.validation_notes,
                })

        return {
            "mission_id": m.mission_id,
            "name": m.name,
            "description": m.description,
            "creator": m.creator,
            "status": m.status,
            "tasks_completed": m.tasks_completed,
            "tasks_total": m.tasks_total,
            "created_at": m.created_at,
            "tasks": tasks_detail,
        }

    @gl.public.view
    def get_task(self, task_id: str) -> dict:
        """Devuelve el estado de una tarea específica."""
        if task_id not in self.tasks:
            raise Exception(f"Task {task_id} not found")

        t = self.tasks[task_id]
        return {
            "task_id": t.task_id,
            "task_type": t.task_type,
            "description": t.description,
            "assigned_agent": t.assigned_agent,
            "min_reputation": t.min_reputation,
            "depends_on": t.depends_on,
            "status": t.status,
            "result_data": t.result_data,
            "validation_notes": t.validation_notes,
        }

    @gl.public.view
    def get_factory_stats(self) -> dict:
        """Estadísticas globales del protocolo."""
        return {
            "total_missions": self.total_missions,
            "total_tasks_validated": self.total_tasks_validated,
            "agent_registry": AGENT_REGISTRY,
            "protocol": "AlephRob v1.0",
            "network": "Bradbury Testnet",
        }

    @gl.public.view
    def can_start_task(self, task_id: str) -> dict:
        """
        Verifica si una tarea puede iniciarse ahora.
        Útil para que los rovers consulten antes de actuar.
        """
        if task_id not in self.tasks:
            return {"can_start": False, "reason": "Task not found"}

        task = self.tasks[task_id]

        if task.status != "PENDING":
            return {
                "can_start": False,
                "reason": f"Task status is {task.status}, must be PENDING",
            }

        if task.depends_on != "":
            if task.depends_on not in self.tasks:
                return {"can_start": False, "reason": "Dependency task not found"}
            dep = self.tasks[task.depends_on]
            if dep.status != "COMPLETED":
                return {
                    "can_start": False,
                    "reason": f"Waiting for {task.depends_on} (status: {dep.status})",
                }

        return {
            "can_start": True,
            "reason": "All dependencies met",
            "assigned_agent": task.assigned_agent,
            "min_reputation": task.min_reputation,
        }