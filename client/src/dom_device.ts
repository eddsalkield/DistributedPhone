import * as obs from "@/obs";

import {Device} from "./device";

export default class DOMDevice implements Device {
    public readonly on_battery = new obs.Subject<boolean>();
    public readonly on_mobile_data = new obs.Subject<boolean>();

    constructor() {
        const nav: any = window.navigator;

        const nav_conn: any = nav.connection;
        if(nav_conn === undefined) {
            this.on_mobile_data.next(false);
        } else {
            this.on_mobile_data.next(nav_conn.type === "cellular");
            nav_conn.addEventListener("typechange", () => {
                this.on_mobile_data.next(nav_conn.type === "cellular");
            });
        }

        this.on_battery.next(false);
    }
}
