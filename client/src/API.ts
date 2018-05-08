import {Observable, Subject} from "@/obs";

export interface Project {
    id: string;
    title: string;
    description: string;
}

export interface Settings {
    allow_mobile_data: boolean;
    allow_on_battery: boolean;
    projects: string[];
}

export interface GraphPoint {
    x: number;
    y: number;
}

export interface Graphs {
    [name: string]: GraphPoint[];
}

export interface User {
    readonly username: string;
    readonly settings: Observable<Settings>;
    readonly projects: Observable<Map<string, Project>>;
    readonly overview: Observable<string[]>;

    logout(): Promise<void>;
    stop(): Promise<void>;

    updateSettings(upd: Partial<Settings>): void;
    setProjectOn(name: string): void;
    setProjectOff(name: string): void;
    refreshProjects(): Promise<void>;
    requestGraphs(query: string): Promise<Graphs>;
}

export interface ClientState {
    readonly user: Observable<User | null>;

    login(username: string, password: string): Promise<void>;
    loginGuest(): Promise<void>;
    signUp(username: string, password: string): Promise<void>;
}

export class MockClientState implements ClientState {
    public user = new Subject<User | null>(null);

    public login(username: string, password: string): Promise<void> {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if(password !== "a") {
                    reject(new Error("Password not 'a'"));
                    return;
                }

                this.user.next(new MockUser(this, username));

                resolve();
            }, 1000);
        });
    }

    public loginGuest(): Promise<void> {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                this.user.next(new MockUser(this, "guest"));
                resolve();
            }, 1000);
        });
    }

    public signUp(username: string, password: string): Promise<void> {
        return this.login(username, "a");
    }
}

export class MockUser implements User {
    constructor(
        private readonly st: MockClientState,
        public readonly username: string
    ) {}

    public readonly settings = new Subject<Settings>({
        allow_mobile_data: true,
        allow_on_battery: true,
        projects: ["proj1", "proj2", "proj3"],
    });

    public readonly projects = new Subject(new Map([
        {
            id: "proj1",
            title : "Project Title 1",
            description: "description1",
        }, {
            id: "proj2",
            title : "Project Title 2",
            description: "description2",
        }, {
            id: "proj3",
            title : "Project Title 3",
            description: "description3",
        }, {
            id: "proj4",
            title : "Project Title 4",
            description: "description4",
        }, {
            id: "proj5",
            title : "Project Title 5",
            description: "description5",
        }].map((p): [string, Project] => [p.id, p]),
    ));

    public readonly overview = new Subject(["This is a mock"]);

    public logout(): Promise<void> {
        this.st.user.next(null);
        return Promise.resolve();
    }
    public stop(): Promise<void> {
        return Promise.resolve();
    }

    public updateSettings(upd: Partial<Settings>): void {}
    public setProjectOn(name: string): void {}
    public setProjectOff(name: string): void {}
    public refreshProjects(): Promise<void> {
        return Promise.resolve();
    }
    public requestGraphs(query: string): Promise<Graphs> {
        return Promise.resolve({});
    }
}
