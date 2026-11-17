"use strict";
/**
 * Safe Template Interpolation Engine
 * Interpolates variables formatted as {{variableName}} into templates.
 * Strips script tags or dangerous HTML while supporting multiline text.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeValue = sanitizeValue;
exports.interpolateTemplate = interpolateTemplate;
exports.extractTemplateVariables = extractTemplateVariables;
exports.validateTemplate = validateTemplate;
function sanitizeValue(val) {
    if (val === null || val === undefined)
        return '';
    const str = String(val);
    // Basic XSS sanitization
    return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}
function interpolateTemplate(templateText, variables = {}) {
    if (!templateText)
        return '';
    return templateText.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
        if (Object.prototype.hasOwnProperty.call(variables, key)) {
            return sanitizeValue(variables[key]);
        }
        // Also check case-insensitive match
        const lowerKey = key.toLowerCase();
        const matchedKey = Object.keys(variables).find((k) => k.toLowerCase() === lowerKey);
        if (matchedKey) {
            return sanitizeValue(variables[matchedKey]);
        }
        return '';
    });
}
function extractTemplateVariables(templateText) {
    if (!templateText)
        return [];
    const matches = templateText.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [];
    const vars = new Set();
    for (const m of matches) {
        const cleaned = m.replace(/[\{\}\s]/g, '');
        if (cleaned)
            vars.add(cleaned);
    }
    return Array.from(vars);
}
function validateTemplate(templateText, requiredVariables = []) {
    if (!templateText || templateText.trim() === '') {
        return { isValid: false, missingVariables: ['Template body cannot be empty'] };
    }
    const existingVars = extractTemplateVariables(templateText);
    const missing = requiredVariables.filter((rv) => !existingVars.includes(rv));
    return {
        isValid: missing.length === 0,
        missingVariables: missing,
    };
}
