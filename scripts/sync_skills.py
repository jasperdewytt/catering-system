from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]

SOURCE = ROOT / "skills"
TARGETS = [
    ROOT / ".claude" / "skills",
    ROOT / ".agents" / "skills",
]

IGNORE = shutil.ignore_patterns(
    "__pycache__",
    ".DS_Store",
    "*.pyc",
)


def sync_dir(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    dst.mkdir(parents=True, exist_ok=True)

    for skill_dir in src.iterdir():
        if not skill_dir.is_dir():
            continue

        skill_file = skill_dir / "SKILL.md"
        if not skill_file.exists():
            raise FileNotFoundError(f"Missing SKILL.md in {skill_dir}")

        shutil.copytree(
            skill_dir,
            dst / skill_dir.name,
            ignore=IGNORE,
        )


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError("Missing canonical skills/ directory")

    for target in TARGETS:
        sync_dir(SOURCE, target)

    print("Synced skills to .claude/skills and .agents/skills")


if __name__ == "__main__":
    main()
