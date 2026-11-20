// `better-ajv-errors` adds ANSI colour codes when the output is a terminal,
// and the tests assert on the plain text. Disable colour for every test run,
// including a run in a colour terminal, so the rendered text is stable.
process.env.FORCE_COLOR = '0';
