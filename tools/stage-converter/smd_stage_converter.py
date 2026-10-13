#!/usr/bin/env python3
"""Read-only Sailor Moon Drops stage converter.

Converts the extracted lvl_*.bin.txt files into a deduplicated, web-friendly
JSON package. WW is the base data set; JP only stores files that are different
or exclusive (mainly ADV/Game Center stages).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
from collections import Counter
from pathlib import Path
from typing import Any


SCHEMA = "smdrops-web-stage/v1"

SERIES = {
    0: "SM_FIRST", 1: "SM_R", 2: "SM_S", 3: "SM_SS", 4: "SM_STARS",
    5: "SM_EV", 10: "SM_GF00", 100: "SM_ADV", 101: "SM_MESSAGECARD",
    200: "SM_DCEV", 999: "SM_ALL",
}

TILE_FORMS = {
    -1: "NONE", 0: "NORMAL", 1: "WAVE_V", 2: "WAVE_H", 3: "BOMB",
    4: "BOMB_B", 5: "RAINBOW", 6: "ADDTIME", 7: "TIMER_BOMB",
    8: "JEWEL", 9: "PAINT", 10: "TAP_BOMB", 11: "ADDPLUS",
    12: "ADDHP", 13: "FOOT_STAMP", 14: "JEWEL3", 15: "JEWEL5",
    16: "JEWEL9", 17: "PEARL", 18: "SKILL", 19: "MAXNUM",
}

_TILE_KIND_NAMES = [
    "COLOR0", "COLOR1", "COLOR2", "COLOR3", "COLOR4", "COLOR5", "COLOR6",
    "SPECIAL", "INGREDIENT0", "INGREDIENT1", "INGREDIENT2", "INGREDIENT3",
    "NORMAL", "EDGE", "THROUGH", "WALL", "SPAWN", "EXIT", "THROUGH_WALL0",
    "THROUGH_WALL1", "THROUGH_WALL2", "BROKEN_WALL0", "BROKEN_WALL1",
    "BROKEN_WALL2", "MOVABLE_WALL0", "MOVABLE_WALL1", "MOVABLE_WALL2",
    "CAPTURE0", "CAPTURE1", "CAPTURE2", "PRESENTBOX0", "PRESENTBOX1",
    "PRESENTBOX2", "PRESENTBOX3", "INCREASE", "GROWN_UP0", "GROWN_UP1",
    "GROWN_UP2", "PAIR0_PARTS", "PAIR0_COMPLETE", "PAIR1_PARTS",
    "PAIR1_COMPLETE", "KEY0", "KEY1", "KEY2", "KEY3", "BOSS0", "FIND0",
    "FIND1", "FIND2", "FIND3", "WARP_IN", "WARP_OUT", "SKILL_BALL",
    "PRESENTBOX4", "PRESENTBOX5", "PRESENTBOX6", "PRESENTBOX7", "PRESENTBOX8",
    "PRESENTBOX9", "PRESENTBOX10", "PRESENTBOX11", "PRESENTBOX12",
    "PRESENTBOX13", "PRESENTBOX14", "PRESENTBOX15", "PRESENTBOX16",
    "PRESENTBOX17", "PRESENTBOX18", "PRESENTBOX19", "PRESENTBOX20",
    "PRESENTBOX21", "PRESENTBOX22", "PRESENTBOX23", "KEY4", "KEY5", "KEY6",
    "KEY7", "ORB_WAVE_V0", "ORB_WAVE_V1", "ORB_WAVE_V2", "ORB_WAVE_H0",
    "ORB_WAVE_H1", "ORB_WAVE_H2", "ORB_BOMB0", "ORB_BOMB1", "ORB_BOMB2",
    "ORB_BOSSDAMAGE0", "ORB_BOSSDAMAGE1", "ORB_BOSSDAMAGE2", "DIANA",
    "DIANA_GOAL_L", "DIANA_GOAL_R", "DIANA_ROUTE", "FIXED_FLOWER0",
    "FIXED_FLOWER1", "MOVABLE_FLOWER0", "MOVABLE_FLOWER1", "TALISMAN0_0",
    "TALISMAN1_0", "TALISMAN2_0", "TALISMAN0_1", "TALISMAN1_1",
    "TALISMAN2_1", "TALISMAN0_2", "TALISMAN1_2", "TALISMAN2_2",
    "TALISMAN0_3", "TALISMAN1_3", "TALISMAN2_3", "STAR", "KEY8", "MAXNUM",
]
TILE_KINDS = {-1: "NONE", **dict(enumerate(_TILE_KIND_NAMES))}
TILE_KINDS.update({
    1000: "WAVE", 1001: "BOMB", 1002: "RAINBOW", 1003: "WAVE_WAVE",
    1004: "BOMB_BOMB", 1005: "RAINBOW_RAINBOW", 1006: "WAVE_BOMB",
    1007: "BOMB_RAINBOW", 1008: "WAVE_RAINBOW", 1009: "PAINT",
    1010: "BOMB_PAINT", 1011: "WAVE_PAINT", 1012: "PAINT_RAINBOW",
    1013: "PAINT_PAINT", 1014: "SPECIAL_MAXNUM",
})

BOOSTERS = {
    0: "NONE", 1: "WAVE_BOMB", 2: "TAP_BOMB2", 3: "RAINBOW",
    4: "ADD_SCORE", 5: "SKILL_CHARGE", 6: "SELECT_ONE",
    7: "SELECT_COLLECT", 8: "COLOR_CRUSH", 9: "BLOCK_CRUSH",
    10: "MUGEN_HEART15", 11: "MUGEN_HEART30", 12: "MUGEN_HEART60",
    13: "PAIR_MAKER", 14: "ALL_CRUSH", 15: "MAX",
}

BOSS_ATTACKS = {0: "NONE", 1: "NORMAL", 2: "CHANGE_COLORS", 3: "SPAWN_PLATE", 4: "SPAWN_FAMILIAR"}


class Reader:
    def __init__(self, data: bytes, label: str):
        self.data = data
        self.pos = 0
        self.label = label

    @property
    def remaining(self) -> int:
        return len(self.data) - self.pos

    def _take(self, size: int) -> bytes:
        end = self.pos + size
        if size < 0 or end > len(self.data):
            raise ValueError(f"{self.label}: unexpected EOF at 0x{self.pos:X}, need {size} bytes")
        value = self.data[self.pos:end]
        self.pos = end
        return value

    def u8(self) -> int:
        return self._take(1)[0]

    def boolean(self) -> bool:
        return self.u8() != 0

    def i16(self) -> int:
        return struct.unpack(">h", self._take(2))[0]

    def u16(self) -> int:
        return struct.unpack(">H", self._take(2))[0]

    def i32(self) -> int:
        return struct.unpack(">i", self._take(4))[0]

    def f32(self) -> float:
        return struct.unpack(">f", self._take(4))[0]

    def utf(self) -> str:
        size = self.u16()
        return self._take(size).decode("utf-8")


def named(value: int, names: dict[int, str]) -> dict[str, Any]:
    return {"id": value, "name": names.get(value, f"UNKNOWN_{value}")}


def read_tile(r: Reader) -> dict[str, Any]:
    return {"kind": named(r.i32(), TILE_KINDS), "form": named(r.i32(), TILE_FORMS)}


def read_attribute(r: Reader, depth: int = 0) -> dict[str, Any]:
    if depth > 64:
        raise ValueError(f"{r.label}: unreasonable attribute chain")
    result = {"kind": named(r.i32(), TILE_KINDS), "form": named(r.i32(), TILE_FORMS)}
    if r.boolean():
        result["next"] = read_attribute(r, depth + 1)
    return result


def read_tile_info(r: Reader, version: int) -> dict[str, Any]:
    stock_count = r.i32()
    if not 0 <= stock_count <= 1024:
        raise ValueError(f"{r.label}: invalid stock count {stock_count}")
    info: dict[str, Any] = {
        "stocks": [r.utf() for _ in range(stock_count)],
        "timerRemain": r.i32(),
        "fall": {
            "ingredient": r.boolean(), "presentBox": r.boolean(),
            "movableWall": r.boolean(), "pair": r.boolean(), "timerBomb": r.boolean(),
        },
    }
    if version >= 10010:
        info["blank"] = r.boolean()
    if version >= 10040:
        info["findImage"] = r.utf()
        info["findSize"] = {"width": r.i32(), "height": r.i32()}
    if version >= 10060:
        info["warp"] = {"index": r.i32(), "outX": r.i32(), "outY": r.i32()}
    if version >= 10080:
        info["find"] = r.boolean()
        info["findRotate"] = r.i32()
    if version >= 10090:
        info["findType"] = named(r.i32(), TILE_KINDS)
    if version >= 10110:
        info["makeObstacleArea"] = r.boolean()
    if version >= 10120:
        info["familiarSpirit"] = {"enabled": r.boolean(), "id": r.u8()}
    if version >= 10140:
        info["dianaWay"] = r.u8()
    return info


def parse_stage(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    r = Reader(data, path.name)
    signature = r.utf()
    if signature != "SMD":
        raise ValueError(f"{path.name}: expected SMD signature, got {signature!r}")
    version = r.i32()
    revision = r.i32()
    series_id = r.u8() if version >= 10030 else 0
    stored_stage_number = r.i32()
    event_id = r.i32() if version >= 10100 else (0 if series_id in (5, 100) else -1)
    if version >= 10020:
        main_stage, sub_stage = r.i32(), r.i32()
    else:
        main_stage, sub_stage = divmod(stored_stage_number, 100)
    stored_candy_count = r.i32()
    if version >= 10010:
        colors = [r.boolean() for _ in range(7)]
    else:
        colors = [i < stored_candy_count for i in range(7)]
    stage_type = r.utf()
    if version >= 10010:
        win_type, lose_type = r.utf(), r.utf()
    else:
        win_type, lose_type = "DERIVED_FROM_STAGE_TYPE", "DERIVED_FROM_STAGE_TYPE"

    limits = {"moves": r.i32(), "timeSeconds": r.i32()}
    stars = {"bronze": r.i32(), "silver": r.i32(), "gold": r.i32()}
    targets = {
        "colors": [r.i32() for _ in range(7)],
        "ingredients": [r.i32() for _ in range(4)],
    }
    before = [named(r.i32(), BOOSTERS) for _ in range(3)]
    before.extend(named(r.i32(), BOOSTERS) for _ in range(3)) if version >= 10060 else before.extend([named(0, BOOSTERS)] * 3)
    in_puzzle = [named(r.i32(), BOOSTERS) for _ in range(3)] if version >= 10070 else [named(v, BOOSTERS) for v in (6, 7, 8)]
    generation = {
        "bonusFreq": r.f32(), "bonusMove": r.f32(), "bonusLimit": r.i32(),
        "bonusMoveLimit": r.i32(),
    }
    special_scores = dict(zip(
        ("wave", "bomb", "rainbow", "waveWave", "bombBomb", "rainbowRainbow", "waveBomb", "bombRainbow", "waveRainbow"),
        (r.i32() for _ in range(9)),
    ))
    presentation = {"bgm": r.utf(), "eventCode": r.utf(), "segmentCode": r.utf(), "testCode": r.utf()}
    generation["timers"] = [r.i32() for _ in range(6)]
    generation.update({"timerFreq": r.f32(), "timerLimit": r.i32(), "timerRemainMin": r.i32(), "timerRemainMax": r.i32()})
    targets["pair0"] = r.i32()
    targets["pairLimit0"] = r.i32()
    generation.update({"jewelFreq": r.f32(), "jewelLimit": r.i32()})
    generation["cookies"] = [{"freq": r.f32(), "limit": r.i32()} for _ in range(3)]

    boss: dict[str, Any]
    if version >= 10040:
        boss = {
            "type": named(r.i16(), TILE_KINDS), "hp": r.i32(), "position": {"x": r.i32(), "y": r.i32()},
            "attackCandyCount": r.i32(), "attackColors": [r.boolean() for _ in range(7)],
            "firstAttack": r.i32(), "attackInterval": r.i32(), "silverCrystal": r.i32(), "enemyGhost": r.i32(),
        }
    else:
        boss = {"type": named(-1, TILE_KINDS), "hp": 0}
    if version >= 10050:
        boss.update({"id": r.i32(), "attackPattern": named(r.i16(), BOSS_ATTACKS), "attackParam": r.i32(), "weakCharacter": r.utf()})
    if version >= 10110:
        boss.update({"attackParam2": r.i32(), "attackParam3": r.i32()})
    if version >= 10130:
        generation["orbs"] = [{"freq": r.f32(), "limit": r.i32()} for _ in range(4)]
    if version >= 10140:
        generation["footPiece"] = {"freq": r.f32(), "limit": r.i32()}
    if version >= 10150:
        generation["fallingJewel"] = {
            "freq": r.f32(), "limits": {"jewel1": r.i32(), "jewel3": r.i32(), "jewel5": r.i32(), "jewel9": r.i32()},
        }
        generation["pearls"] = [{"freq": r.f32(), "limit": r.i32()} for _ in range(3)]

    width, height = r.i32(), r.i32()
    if not (1 <= width <= 64 and 1 <= height <= 64):
        raise ValueError(f"{path.name}: unreasonable board {width}x{height}")
    play_area = {"x": 0, "y": 0, "width": width, "height": height}
    if version >= 10010:
        play_area = {"x": r.i32(), "y": r.i32(), "width": r.i32(), "height": r.i32()}
    cells = [{"x": x, "y": y} for y in range(height) for x in range(width)]
    coordinate_mismatches: list[dict[str, Any]] = []

    def read_grid_pass(key: str, read_value: Any) -> None:
        for y in range(height):
            for x in range(width):
                file_x, file_y = r.i32(), r.i32()
                if (file_x, file_y) != (x, y):
                    coordinate_mismatches.append({"pass": key, "expected": [x, y], "stored": [file_x, file_y]})
                if r.boolean():
                    cells[y * width + x][key] = read_value()

    read_grid_pass("tile", lambda: read_tile(r))
    read_grid_pass("attributes", lambda: read_attribute(r))
    read_grid_pass("info", lambda: read_tile_info(r, version))

    result = {
        "$schema": SCHEMA,
        "source": {"file": path.name, "sha256": hashlib.sha256(data).hexdigest(), "byteLength": len(data)},
        "format": {"signature": signature, "version": version, "revision": revision},
        "identity": {
            "series": named(series_id, SERIES), "storedStageNumber": stored_stage_number,
            "eventId": event_id, "mainStage": main_stage, "subStage": sub_stage,
        },
        "rules": {
            "stageType": stage_type, "winCondition": win_type, "loseCondition": lose_type,
            "limits": limits, "starScores": stars, "targets": targets,
            "colors": {"count": sum(colors), "enabled": colors},
            "boosters": {"beforeStage": before, "inPuzzle": in_puzzle},
            "specialScores": special_scores,
        },
        "generation": generation,
        "presentation": presentation,
        "boss": boss,
        "board": {"width": width, "height": height, "playArea": play_area, "cells": cells},
        "audit": {"trailingBytes": r.remaining, "coordinateMismatches": coordinate_mismatches},
    }
    if r.remaining:
        result["audit"]["trailingHex"] = r._take(r.remaining).hex()
    return result


def write_json(path: Path, value: Any, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2 if pretty else None, separators=None if pretty else (",", ":"))
        handle.write("\n")


def catalog_item(stage: dict[str, Any], relative_path: str, variant: str) -> dict[str, Any]:
    identity, rules, board = stage["identity"], stage["rules"], stage["board"]
    return {
        "file": stage["source"]["file"], "json": relative_path.replace("\\", "/"), "variant": variant,
        "sha256": stage["source"]["sha256"], "formatVersion": stage["format"]["version"],
        "series": identity["series"], "eventId": identity["eventId"],
        "mainStage": identity["mainStage"], "subStage": identity["subStage"],
        "stageType": rules["stageType"], "winCondition": rules["winCondition"],
        "loseCondition": rules["loseCondition"], "width": board["width"], "height": board["height"],
    }


def convert(source: Path, output: Path) -> int:
    ww = source / "Files (WW)" / "APK Files (WW)" / "Text Files"
    jp = source / "Files (JP)" / "APK Files (JP)" / "Text Files"
    if not ww.is_dir() or not jp.is_dir():
        raise SystemExit("Source must contain Files (WW) and Files (JP) extracted Text Files folders")
    ww_files = {p.name: p for p in ww.glob("lvl_*.bin.txt")}
    jp_files = {p.name: p for p in jp.glob("lvl_*.bin.txt")}
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, Any]] = []
    catalog: list[dict[str, Any]] = []
    stats = Counter()

    def emit(path: Path, folder: str, variant: str) -> None:
        try:
            stage = parse_stage(path)
            target_name = path.name.removesuffix(".bin.txt") + ".json"
            relative = f"stages/{folder}/{target_name}"
            write_json(output / relative, stage)
            catalog.append(catalog_item(stage, relative, variant))
            stats[f"written_{variant}"] += 1
            stats[f"series_{stage['identity']['series']['name']}"] += 1
            stats[f"type_{stage['rules']['stageType']}"] += 1
            if stage["audit"]["trailingBytes"] or stage["audit"]["coordinateMismatches"]:
                warnings.append({"file": path.name, "variant": variant, **stage["audit"]})
        except Exception as exc:  # retain a complete audit rather than stopping at the first bad file
            errors.append({"file": str(path), "variant": variant, "error": str(exc)})

    for name in sorted(ww_files):
        emit(ww_files[name], "base", "ww-base")

    identical = 0
    different = 0
    jp_only = 0
    for name in sorted(jp_files):
        if name in ww_files:
            if jp_files[name].read_bytes() == ww_files[name].read_bytes():
                identical += 1
                continue
            different += 1
            emit(jp_files[name], "jp-overrides", "jp-different")
        else:
            jp_only += 1
            emit(jp_files[name], "jp-overrides", "jp-only")

    catalog.sort(key=lambda x: (x["variant"], x["file"]))
    summary = {
        "$schema": "smdrops-stage-package/v1",
        "strategy": "WW base plus only different or JP-exclusive overrides",
        "sourceCounts": {"ww": len(ww_files), "jp": len(jp_files)},
        "deduplication": {"identicalCommonFiles": identical, "jpDifferentFiles": different, "jpOnlyFiles": jp_only},
        "outputCounts": dict(stats),
        "catalogEntries": len(catalog), "warnings": len(warnings), "errors": len(errors),
    }
    write_json(output / "catalog.json", {"summary": summary, "stages": catalog}, pretty=True)
    write_json(output / "audit.json", {"summary": summary, "warnings": warnings, "errors": errors}, pretty=True)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 1 if errors else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert SMD lvl_*.bin.txt stages to JSON")
    parser.add_argument("--source", type=Path, required=True, help="Root of SMDrops-AssetDump-Full")
    parser.add_argument("--output", type=Path, required=True, help="New output directory")
    args = parser.parse_args()
    if args.output.exists() and any(args.output.iterdir()):
        raise SystemExit(f"Output directory is not empty: {args.output}")
    args.output.mkdir(parents=True, exist_ok=True)
    return convert(args.source, args.output)


if __name__ == "__main__":
    sys.exit(main())

