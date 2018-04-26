import "@/polyfill";

import Controller from "@/controller";

const ctl = new Controller("http://35.178.90.246/api/");
ctl.setProject("hvenev-collatz");
ctl.login("hvenev", "password");

(self as any).ctl = ctl;

(self as any).stop = () => {
    ctl.resetExec().then(() => {
        console.log("Stopped");
    });
};

(self as any).start = () => {
    ctl.startExec();
};
