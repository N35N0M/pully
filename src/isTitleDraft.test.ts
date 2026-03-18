import { assertEquals } from "jsr:@std/assert";
import { isTitleDraft } from "./isTitleDraft.ts";

Deno.test("isTitleDraft - WIP prefix variants", () => {
	assertEquals(isTitleDraft("WIP my feature"), true);
	assertEquals(isTitleDraft("WIP - my feature"), true);
	assertEquals(isTitleDraft("WIP: my feature"), true);
	assertEquals(isTitleDraft("wip my feature"), true);
	assertEquals(isTitleDraft("wip: my feature"), true);
	assertEquals(isTitleDraft("[WIP] my feature"), true);
	assertEquals(isTitleDraft("[WIP]: my feature"), true);
});

Deno.test("isTitleDraft - DRAFT prefix variants", () => {
	assertEquals(isTitleDraft("DRAFT my feature"), true);
	assertEquals(isTitleDraft("DRAFT - my feature"), true);
	assertEquals(isTitleDraft("DRAFT: my feature"), true);
	assertEquals(isTitleDraft("draft my feature"), true);
	assertEquals(isTitleDraft("[DRAFT] my feature"), true);
});

Deno.test("isTitleDraft - non-draft titles", () => {
	assertEquals(isTitleDraft("Add new feature"), false);
	assertEquals(isTitleDraft("Fix bug in parser"), false);
	assertEquals(isTitleDraft("Update dependencies"), false);
	// WIP/DRAFT not at start
	assertEquals(isTitleDraft("My WIP feature"), false);
	assertEquals(isTitleDraft("Feature is DRAFT"), false);
});
