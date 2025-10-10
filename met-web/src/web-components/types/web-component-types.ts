export interface ConvertedProp {
    name: string;
    value: string | number | boolean | object;
}

export interface EventMap {
    [key: string]: (args?: Record<string, unknown>) => void;
}
