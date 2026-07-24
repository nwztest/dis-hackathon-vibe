from datetime import datetime, timedelta, timezone
import unittest

import main


class FallDetectionTests(unittest.TestCase):
    def setUp(self) -> None:
        main.room_motion_states.clear()

    def test_arms_spread_does_not_turn_standing_pose_into_lying(self) -> None:
        points = standing_points()
        points[7] = [40, 180]
        points[8] = [600, 180]
        points[9] = [10, 190]
        points[10] = [630, 190]

        posture = main.estimate_posture([10, 80, 630, 470], points, confidences())

        self.assertEqual(posture, "standing")

    def test_bent_knees_classify_vertical_torso_as_sitting(self) -> None:
        points = standing_points()
        points[13] = [260, 370]
        points[14] = [340, 370]
        points[15] = [360, 370]
        points[16] = [440, 370]

        posture = main.estimate_posture([220, 80, 450, 390], points, confidences())

        self.assertEqual(posture, "sitting")

    def test_rapid_upright_to_lying_transition_requires_confirmation(self) -> None:
        started_at = datetime(2026, 7, 24, 1, 0, tzinfo=timezone.utc)
        first = main.analyze_temporal_pose(
            "room-1",
            started_at.isoformat(),
            "2fps",
            (640, 480),
            person([220, 70, 390, 470], standing_points()),
            "standing",
        )
        candidate = main.analyze_temporal_pose(
            "room-1",
            (started_at + timedelta(milliseconds=500)).isoformat(),
            "2fps",
            (640, 480),
            person([90, 270, 550, 410], lying_points()),
            "lying",
        )
        confirmed = main.analyze_temporal_pose(
            "room-1",
            (started_at + timedelta(seconds=1)).isoformat(),
            "2fps",
            (640, 480),
            person([92, 272, 552, 412], lying_points(y_offset=2)),
            "lying",
        )

        self.assertEqual(first.fall_stage, "none")
        self.assertEqual(candidate.fall_stage, "candidate")
        self.assertGreaterEqual(candidate.fall_confidence, 60)
        self.assertEqual(confirmed.fall_stage, "confirmed")
        self.assertTrue(confirmed.fall_detected)

    def test_five_second_sampling_does_not_claim_fall_velocity(self) -> None:
        started_at = datetime(2026, 7, 24, 1, 0, tzinfo=timezone.utc)
        main.analyze_temporal_pose(
            "room-2",
            started_at.isoformat(),
            "5s",
            (640, 480),
            person([220, 70, 390, 470], standing_points()),
            "standing",
        )
        result = main.analyze_temporal_pose(
            "room-2",
            (started_at + timedelta(seconds=5)).isoformat(),
            "5s",
            (640, 480),
            person([90, 270, 550, 410], lying_points()),
            "lying",
        )

        self.assertEqual(result.fall_stage, "none")
        self.assertFalse(result.fall_detected)

    def test_slow_transition_to_lying_is_not_a_fall(self) -> None:
        started_at = datetime(2026, 7, 24, 1, 0, tzinfo=timezone.utc)
        main.analyze_temporal_pose(
            "room-3",
            started_at.isoformat(),
            "2fps",
            (640, 480),
            person([220, 70, 390, 470], standing_points()),
            "standing",
        )
        main.analyze_temporal_pose(
            "room-3",
            (started_at + timedelta(seconds=1)).isoformat(),
            "2fps",
            (640, 480),
            person([220, 120, 440, 450], sitting_points()),
            "sitting",
        )
        result = main.analyze_temporal_pose(
            "room-3",
            (started_at + timedelta(seconds=4)).isoformat(),
            "2fps",
            (640, 480),
            person([90, 270, 550, 410], lying_points()),
            "lying",
        )

        self.assertEqual(result.fall_stage, "none")
        self.assertFalse(result.fall_detected)


def person(box: list[float], points: list[list[float]]) -> dict:
    return {
        "box": box,
        "keypoints": points,
        "keypoint_confidences": confidences(),
        "confidence": 0.9,
    }


def confidences() -> list[float]:
    return [0.9] * 17


def standing_points() -> list[list[float]]:
    return [
        [300, 70],
        [290, 65],
        [310, 65],
        [280, 70],
        [320, 70],
        [260, 140],
        [340, 140],
        [240, 220],
        [360, 220],
        [230, 290],
        [370, 290],
        [270, 300],
        [330, 300],
        [275, 390],
        [325, 390],
        [280, 465],
        [320, 465],
    ]


def lying_points(y_offset: float = 0) -> list[list[float]]:
    return [
        [115, 315 + y_offset],
        [110, 310 + y_offset],
        [120, 310 + y_offset],
        [105, 315 + y_offset],
        [125, 315 + y_offset],
        [165, 305 + y_offset],
        [165, 345 + y_offset],
        [230, 295 + y_offset],
        [230, 355 + y_offset],
        [285, 290 + y_offset],
        [285, 360 + y_offset],
        [355, 315 + y_offset],
        [355, 355 + y_offset],
        [430, 318 + y_offset],
        [430, 358 + y_offset],
        [520, 320 + y_offset],
        [520, 360 + y_offset],
    ]


def sitting_points() -> list[list[float]]:
    points = standing_points()
    points[5] = [260, 180]
    points[6] = [340, 180]
    points[11] = [270, 310]
    points[12] = [330, 310]
    points[13] = [280, 390]
    points[14] = [320, 390]
    points[15] = [380, 390]
    points[16] = [420, 390]
    return points


if __name__ == "__main__":
    unittest.main()
