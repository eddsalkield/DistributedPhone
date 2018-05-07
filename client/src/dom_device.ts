import * as obs from "@/obs";

import {Device} from "./device";

export default class DOMDevice implements Device {
    public readonly on_battery = new obs.Subject<boolean>();
    public readonly on_mobile_data = new obs.Subject<boolean>();

    constructor() {
        const nav: any = window.navigator;

        if(nav.connection === undefined) {
            this.on_mobile_data.error(new Error("Not available"));
        } else {
            this.on_mobile_data.next(nav.connection.type === "cellular");
            nav.connection.addEventListener("typechange", () => {
                this.on_mobile_data.next(nav.connection.type === "cellular");
            });
        }

        if(nav.getBattery === undefined) {
            this.on_battery.error(new Error("Not available"));
        } else {
            nav.getBattery().then((bat: any) => {
                this.on_battery.next(!bat.charging);
                bat.addEventListener("chargingchange", () => {
                    this.on_battery.next(!bat.charging);
                });
            }, (e: Error) => {
                this.on_battery.error(e);
            });
        }
    }
}
