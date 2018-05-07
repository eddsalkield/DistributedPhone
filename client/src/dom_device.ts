import * as obs from "@/obs";

import {Device} from "./device";

export default class DOMDevice implements Device {
    public readonly on_battery = new obs.Subject<boolean>();
    public readonly on_mobile_data = new obs.Subject<boolean>();

    constructor() {
        const nav: any = window.navigator;

        if(nav.connection === undefined) {
            this.on_mobile_data.next(false);
        } else {
            this.on_mobile_data.next(nav.connection.type === "none");
            nav.connection.addEventListener("typechange", () => {
                this.on_mobile_data.next(nav.connection.type === "none");
            });
        }

        this.on_battery.next(false);
    }
}
