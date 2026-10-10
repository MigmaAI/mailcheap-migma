import assert from "node:assert/strict";
import { test } from "node:test";
import { formatChange, formatHour, formatSigned } from "../lib/format.js";
import { compareCount, compareRate } from "../lib/overview-series.js";

test("changes need something to compare with; rates change by their difference, shown in %", () => {
	assert.equal(compareCount(12, 0), null);
	assert.equal(compareCount(15, 10), 50);
	assert.equal(compareRate(1, 0, 1, 10), null);
	assert.ok(Math.abs(compareRate(99, 100, 98, 100) - 1) < 1e-9);
	assert.equal(formatChange(8.4), "+8%");
	assert.equal(formatChange(compareRate(391, 1000, 418, 1000), { digits: 1 }), "−2.7%");
	assert.equal(formatChange(-0.24, { digits: 1 }), "−0.2%");
	assert.equal(formatChange(0.004, { digits: 1 }), "0.0%");
	assert.equal(formatChange(null), null);
	assert.equal(formatSigned(1204), "+1,204");
	assert.equal(formatSigned(-32), "−32");
	assert.equal(formatSigned(0), "0");
	assert.equal(formatHour(0), "12 AM");
	assert.equal(formatHour(14), "2 PM");
});
