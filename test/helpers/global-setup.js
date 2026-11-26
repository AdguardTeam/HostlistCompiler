/**
 * Runs the test suite in a non-UTC timezone.
 *
 * CI runs in UTC, where a value built from the local wall-clock time is equal
 * to the UTC value, so a test that asserts a UTC timestamp cannot tell the two
 * apart. Europe/Berlin is one hour ahead of UTC in November, when the header
 * test freezes the clock, so a local-time regression fails the assertion.
 *
 * The timezone can only be set before the test environments create their
 * `Date` objects; `process.env.TZ` inside a test does not reach the sandbox.
 */
module.exports = () => {
    process.env.TZ = 'Europe/Berlin';
};
