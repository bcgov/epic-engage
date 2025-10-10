// Override Node.js timer types with browser-compatible types
declare global {
    // Override NodeJS.Timer with browser's number type
    namespace NodeJS {
        type Timeout = number;
        type Timer = number;
    }
}

export {};
