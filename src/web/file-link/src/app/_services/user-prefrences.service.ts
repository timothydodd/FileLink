import { EventEmitter, Injectable } from "@angular/core";
import { Dictionary } from "../_helpers/dictionary";

@Injectable()
export class UserPreferenceService {
    settings = new Dictionary<any>();
    settingsChanged = new EventEmitter<any>();
    private saveKey = 'settings-preferences';
    constructor() {
        try {
            const item = localStorage.getItem(this.saveKey);
            if (item) {
                const settings = JSON.parse(item);
                if (settings?.items)
                    for (const prop in settings.items) {
                        const value = settings.items[prop];
                        if (value?.shortLived === true)
                            continue;
                        this.settings.set(prop, value);
                    }
            }
        } catch (err) {
            console.error(err);
        }

    }
    public get(name: string) {
        return this.settings.get(name);
    }
    public set(name: string, value: any, shortLived = false) {
        if (shortLived) {
            this.settings.set(name, { ...value, shortLived });
        } else {
            this.settings.set(name, value);
        }
        this.settingsChanged.emit(name);
        localStorage.setItem(this.saveKey, JSON.stringify(this.settings));
    }
}
