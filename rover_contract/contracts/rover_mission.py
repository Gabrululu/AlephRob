# { "Depends": "py-genlayer:test" }

import json
from dataclasses import dataclass
from genlayer import *


@allow_storage
@dataclass
class Sample:
    sample_id: str
    x: str
    y: str
    confidence: str
    decision: str


class RoverMission(gl.Contract):
    samples: DynArray[Sample]
    total_approved: u256
    mission_complete: bool

    def __init__(self):
        self.total_approved = u256(0)
        self.mission_complete = False

    def _evaluate_sample(self, x: str, y: str, confidence: str) -> str:
        def get_decision() -> str:
            task = f"""You are a planetary geologist evaluating Mars rover samples.
The rover found a sample at coordinates ({x}, {y}) with sensor confidence {confidence}.
Does this sample have scientific value? Consider:
- Coordinates should be within -5.0 to 5.0 range
- Confidence should be above 0.5
Respond with exactly one word: APPROVED or REJECTED"""
            result = gl.nondet.exec_prompt(task)
            if "APPROVED" in result.upper():
                return "APPROVED"
            return "REJECTED"

        return gl.eq_principle.strict_eq(get_decision)

    @gl.public.write
    def submit_sample(
        self,
        sample_id: str,
        x: str,
        y: str,
        confidence: str
    ) -> str:
        decision = self._evaluate_sample(x, y, confidence)
        sample = Sample(
            sample_id=sample_id,
            x=x,
            y=y,
            confidence=confidence,
            decision=decision,
        )
        self.samples.append(sample)
        if decision == "APPROVED":
            self.total_approved += u256(1)
            if self.total_approved >= u256(3):
                self.mission_complete = True
        return decision

    @gl.public.view
    def get_mission_status(self) -> dict:
        result = {
            "total_submitted": len(self.samples),
            "total_approved": self.total_approved,
            "mission_complete": self.mission_complete,
            "samples": []
        }
        for s in self.samples:
            result["samples"].append({
                "id": s.sample_id,
                "x": s.x,
                "y": s.y,
                "decision": s.decision,
            })
        return result