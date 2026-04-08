"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newSuccessResponse = newSuccessResponse;
exports.newErrorResponse = newErrorResponse;
function newSuccessResponse(data) {
    return {
        code: 0,
        data
    };
}
function newErrorResponse(code, message) {
    return {
        code,
        message
    };
}
