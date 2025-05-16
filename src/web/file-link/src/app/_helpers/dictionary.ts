export class Dictionary<TValue> {
    private items: { [key: string]: TValue } = {};

    // Add or update a value by key
    public set(key: string, value: TValue): void {
        this.items[key] = value;
    }

    // Get a value by key
    public get(key: string): TValue | null {
        return this.items[key] ?? null;
    }

    // Check if the dictionary contains a key
    public containsKey(key: string): boolean {
        return key in this.items;
    }

    // Remove a key-value pair by key
    public remove(key: string): boolean {
        const exists = key in this.items;
        delete this.items[key];
        return exists;
    }

    // Get all keys in the dictionary
    public keys(): string[] {
        return Object.keys(this.items);
    }

    // Get all values in the dictionary
    public values(): TValue[] {
        return Object.values(this.items);
    }

    // Clear the dictionary
    public clear(): void {
        this.items = {};
    }

    // Get the number of key-value pairs in the dictionary
    public count(): number {
        return Object.keys(this.items).length;
    }
}
