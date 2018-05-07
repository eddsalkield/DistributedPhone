import * as obs from "@/obs";

export interface Device {
    readonly on_battery: obs.Observable<boolean>;
    readonly on_mobile_data: obs.Observable<boolean>;
}
