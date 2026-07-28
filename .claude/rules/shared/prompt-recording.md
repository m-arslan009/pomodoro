## Objective

Maintain a file named prompt.md that records significant user prompts affecting the direction, requirements, workflow, or implementation of the current project or conversation.

Evaluate every user message automatically. Do not ask the user whether a prompt should be recorded.

## File Handling
- Use the file name prompt.md.
- Create the file if it does not already exist.
- Append new entries to the end of the file.
- Never overwrite, delete, reorder, or modify previously recorded entries unless the user explicitly requests it.
- Preserve entries in chronological order.
- Record only user prompts. Do not record assistant responses, internal reasoning, tool output, or system messages.
- Do not create an entry when the prompt does not meet the significance criteria.
- Avoid recording the same instruction more than once unless the new prompt materially changes or expands it.
- Preserve the user's wording as closely as practical while removing only sensitive details or obvious noise.

## Record These Prompts

Record a user prompt when it does one or more of the following:

- Defines, changes, or replaces the overall workflow.
- Requests the creation, design, development, implementation, or restructuring of something substantial.
- Establishes important requirements, constraints, rules, standards, architecture, or expected behavior.
- Introduces a major feature, objective, decision, deliverable, or project direction.
- Changes the project scope, priorities, intended audience, technology, format, or success criteria.
- Provides important information that future work depends on.
- Resolves a major ambiguity or makes a consequential project decision.
- Requests the removal or replacement of a major feature or requirement.
- Corrects an earlier instruction in a way that materially affects future work.

## Do Not Record These Prompts

Do not record a user prompt when it only:

- Requests a minor edit, small correction, typo fix, or formatting adjustment.
- Changes wording, colors, spacing, labels, or presentation without affecting the broader direction.
- Repeats an instruction that has already been recorded without materially changing it.
- Asks a conversational, administrative, or unrelated question.
- Provides acknowledgements such as “okay,” “thanks,” or “continue.”
- Requests a status update or asks what has already been completed.
- Gives temporary operational guidance that has no effect on later work.
- Asks for an explanation, summary, or clarification without establishing a new requirement.
- Contains brainstorming ideas that the user has not selected or adopted as a decision.
- Includes rejected, hypothetical, or purely illustrative requirements unless the user explicitly adopts them.

## Handling Mixed Prompts

When a user message contains both significant and insignificant instructions:

- Record only the significant portions.
- Preserve the user’s original wording as closely as possible.
- Omit unrelated conversation, acknowledgements, and trivial adjustments.
- If the message introduces multiple distinct significant decisions, create separate entries for each one.
- If the instructions belong to the same objective, keep them together in one entry.

## Entry Format

Each recorded prompt should use this structure:

- `Title`: a short descriptive title
- `User prompt`: the significant prompt or significant excerpt from the user message

## Sensitive Information

### Never record:
- Passwords
- API keys
- Access tokens
- Authentication codes
- Private keys
- Credentials
- Session cookies
- Financial account details
- Government identification numbers
- Other secrets or sensitive personal information

If an otherwise significant prompt contains sensitive information:
- Remove or replace the sensitive value with [REDACTED].
- Preserve the remaining non-sensitive instruction.
- Do not mention or reproduce the removed value elsewhere in the entry.

## Wording and Accuracy
- Preserve the user’s original wording as closely as reasonably possible.
- Do not alter the meaning of the prompt.
- Do not add requirements the user did not provide.
- Correct obvious formatting problems only when necessary for readability.
- Use a concise descriptive title based on the prompt’s main purpose.
- Explain significance in one clear sentence.
- Do not include an entry’s significance assessment in the conversation unless the user asks to see it.

## Example
`Title`: Add user authentication
`User prompt`: Implement email-and-password authentication with password reset support and role-based access control for administrators and standard users.

## Execution Rule

After every user message:
- Evaluate whether the message contains a significant prompt.
- Remove any sensitive information from the content to be recorded.
- Check whether the same instruction has already been recorded.
- Append a new formatted entry to prompt.md only when the instruction is significant and materially new.
- Continue responding to the user’s request normally.
- Perform this process automatically without requesting confirmation or announcing routine file updates.