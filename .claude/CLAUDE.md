## Purpose
This file is the top-level index for the `.claude` workspace. It explains what belongs in each directory, how the pieces fit together, and where to look first.

## Directory Structure
```
.claude/
├── CLAUDE.md
├── rules/
│   ├── github.md
│   └── prompt-recording.md
└── skills/
    └── <skill-directory-name>/
        ├── SKILL.md
        ├── references/   # Optional supporting documentation
        ├── examples/     # Optional examples
        ├── templates/    # Optional reusable templates
        └── scripts/      # Optional helper scripts
```

## How To Use This Folder
1. Read this file first.
2. Check `rules/` for persistent instructions that apply whenever the rule is relevant.
3. Check `skills/` for task-specific workflows or reusable procedures.
4. Treat each rule or skill file as the authoritative source for its subject.
5. When a user prompt changes direction, workflow, scope, or requirements in a meaningful way, update `prompt.md` with a concise entry.

## rules/
The `rules/` directory contains persistent instructions that should be followed whenever they apply.

Current rules:
- [github.md](rules/github.md) defines how to handle status checks, staging, commit messages, and pushing code.
- [prompt-recording.md](rules/prompt-recording.md) defines when significant user prompts should be recorded and how entries should be written.

Each rule should:
- Have one clear responsibility.
- Use a descriptive Markdown filename.
- Contain the complete and authoritative instructions for its topic.
- Be written so it can stand on its own without needing extra explanation.

## skills/
The `skills/` directory contains reusable, task-specific capabilities and workflows.

Each skill should:
- Live in its own directory.
- Use `SKILL.md` as the entry file.
- State clearly when the skill should be used and what it does.
- Keep supporting references, examples, templates, and scripts inside the same skill directory.

## Adding New Content
- Add a new rule when you need a persistent instruction that applies across tasks.
- Add a new skill when you want to capture a repeatable workflow or specialized process.
- Keep filenames descriptive and prefer one topic per file.

## Current State
The `skills/` directory is currently empty. Add a new skill folder there when a reusable workflow is needed.

The workspace root also contains [prompt.md](../prompt.md), which is used to record significant user prompts.

When pushing code, follow [rules/github.md](rules/github.md) exactly and keep commit subjects short, scoped, and limited to the actual change. Do not add unrelated details such as tool names or commentary about the editor or agent.