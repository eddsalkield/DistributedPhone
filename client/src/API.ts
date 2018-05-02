
export interface Project{
    Title: string;
    Description: string;
}
export interface AllProjects{
    projects: Project[];
}
//export interface ExposureToUserInterface{
//    getProjects(): Promise<AllProjects>;
//    setChargingOnly(value: boolean): void;
//    setAllowDataUsage(value: boolean): void;
//    setProjectChoiceID(value: number): void;//
//}

//export interface Login{
//    setEmailforconfirmation(email:string, password:string): Promise<boolean>;
//    setLoggedIn(email:string, IsLoggedIn:boolean): void;/
//}

//export interface SignIn{
//    setEmail(value:string):void;
//   setUserNAme(vlaue:string):void;
//    setPassword(value:string):void;
//}

//export interface MyProjects{
//    getMyProjects(email:string): Promise<Project[]>
//}

//export interface AddMyProjects{
//    setNewMyProject(Email:string, ProjectID:number):void;
//}

export interface ClientStateInterface{
    ChargingOnly: boolean;
    AllowDataUsage: boolean; 
    ProjectChoiceID: string | null; 
    IsLoggedIn: boolean;
    login(email: string, password: string): Promise<void> ;
    logout():Promise<void>;
    ListOfAllProjects(): Promise<Project[]>;
    ListOfMyProjects(): Promise<Project[]>;
    NewProjectMyProjectsID: string | null;
    SignUp(NewEmail: string,NewPassword: string,NewUserName: string): Promise<void>;
  
}



export class ClientState implements ClientStateInterface{
    ChargingOnly = false
    AllowDataUsage = true
    ProjectChoiceID = "Bitcoin Mining"
    IsLoggedIn = true;
    login(TheEmail:string, ThePassword:string) :Promise<void> 
        { return Promise.resolve()}
    loginGuest() : Promise<void>
         {return Promise.resolve()}    
    logout() :Promise<void> 
        { return Promise.resolve()}    
    ListOfAllProjects() :Promise<Project[]> {return Promise.resolve([
        {
            Title : 'Project Title 1',
            Description: 'description1'
        },
        {
            Title : 'Project Title 2',
            Description: 'description2'
        },
        {
            Title : 'Project Title 3',
            Description: 'description3'
        },
        {
            Title : 'Project Title 4',
            Description: 'description4'
        },
        {
            Title : 'Project Title 5',
            Description: 'description5'
        },
      ])
    }
    ListOfMyProjects() :Promise<Project[]> {return Promise.resolve([
        {
            Title : 'Project Title 1',
            Description: 'description1'
        },
        {
            Title : 'Project Title 2',
            Description: 'description2'
        },
        {
            Title : 'Project Title 3',
            Description: 'description3'
        }
      ])
    }
    NewProjectMyProjectsID = "Fibonacci counter"
    SignUp(EmailToAdd:string, PasswordToAdd:string):Promise<void> 
    { return Promise.resolve()}

  
}



