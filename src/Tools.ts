import * as React from "react";

declare global {
    interface Array<T> {
        first(predicate: (value: T, index: number, obj: T[]) => any): T;
    }  
}

export function ToolsSetup() {}

if (!Array.prototype.first) {
    Array.prototype.first = function<T>(predicate: (value: T, index: number, obj: T[]) => any) {
        let idx = this.findIndex(predicate);
        if (idx<0) throw "Item not found";
        return this[idx];
    };
}

