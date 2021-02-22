import * as React from "react";

declare global {
    interface Array<T> {
        first(predicate: (value: T, index: number, obj: T[]) => any): T;
    }  
}

export function ToolsSetup() {}

export class Tools {

    public static StateIndex(state: string) {
        switch (state) {
            case "New":         return 1;
            case "Active":      return 2;
            case "Ready":       return 3;
            case "Resolved":    return 4;
            case "Completed":   return 5;
            case "Closed":      return 6;
            case "Removed":     return 7;
            default:            return 8;
        }
    }

}

if (!Array.prototype.first) {
    Array.prototype.first = function<T>(predicate: (value: T, index: number, obj: T[]) => any) {
        let idx = this.findIndex(predicate);
        if (idx<0) throw "Item not found";
        return this[idx];
    };
}

