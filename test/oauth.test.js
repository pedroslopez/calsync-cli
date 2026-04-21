"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const oauth_1 = require("../src/lib/oauth");
(0, node_test_1.default)("buildHeadlessAuthMessage includes the auth URL", () => {
    const url = "https://example.com/auth";
    const message = (0, oauth_1.buildHeadlessAuthMessage)(url);
    strict_1.default.match(message, /No browser could be opened automatically\./);
    strict_1.default.match(message, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    strict_1.default.match(message, /After you approve access/);
});
(0, node_test_1.default)("formatAuthFailure explains invalid_grant", () => {
    const message = (0, oauth_1.formatAuthFailure)({
        response: {
            data: {
                error: "invalid_grant",
                error_description: "Bad Request",
            },
        },
    });
    strict_1.default.match(message, /invalid_grant/);
    strict_1.default.match(message, /expired/);
});
