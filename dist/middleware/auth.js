"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authorize = authorize;
const tokenService_1 = require("../services/tokenService");
const errors_1 = require("../utils/errors");
function authenticate(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next(new errors_1.UnauthorizedError("Access token is missing or malformed"));
    }
    const token = authHeader.split(" ")[1];
    try {
        const payload = tokenService_1.tokenService.verifyAccessToken(token);
        req.user = payload;
        next();
    }
    catch (error) {
        next(error);
    }
}
function authorize(roles) {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new errors_1.UnauthorizedError("Authentication required"));
        }
        if (!roles.includes(req.user.role)) {
            return next(new errors_1.ForbiddenError(`Access denied. Required roles: ${roles.join(", ")}`));
        }
        next();
    };
}
