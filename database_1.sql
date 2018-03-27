CREATE TABLE Customer (
    customerID   Integer    NOT NULL,
    customerName Char(25)   NOT NULL,
    CONSTRAINT  customerPk  PRIMARY KEY(customerID)
);

CREATE TABLE Worker (
    workerID   Integer    NOT NULL,
    userName   Char(25)   NOT NULL,
    password   Char(25)   NOT NULL,
    prefwifidata   Integer  DEFAULT 1,
    prefbattery    Integer  DEFAULT 1,
    CONSTRAINT  workerPk  PRIMARY KEY(workerID),
    CONSTRAINT  projectFk FOREIGN KEY(projectID)
);

CREATE TABLE Project (
    projectID   Integer    NOT NULL,
    projectName Char(25)   NOT NULL,
    status      Char(25)   DEFAULT 'NOT COMPLETE',
    customerID  Integer    NOT NULL,
    CONSTRAINT  projectPk  PRIMARY KEY(projectID),
    CONSTRAINT  customerFk FOREIGN KEY(customerID)
        REFERENCES Customer(customerID) ON DELETE CASCADE,
);

CREATE TABLE Project_task (
    taskID      Integer    NOT NULL,
    controlData DATA,
    status      Char(25)   DEFAULT 'NOT COMPLETE',
    resultData  DATA,
    projectID   Integer    NOT NULL,
    workerID    Integer,
    CONSTRAINT  taskPk  PRIMARY KEY(taskID),
    CONSTRAINT  projectFk FOREIGN KEY(projectID)
        REFERENCES Project(projectID) ON DELETE CASCADE,
    CONSTRAINT  workerFk FOREIGN KEY(workerID)
        REFERENCES Worker(workerID) ON DELETE CASCADE,
);

CREATE TABLE Data_blob (
    blobID      Integer    NOT NULL,
    blobData    BLOB,
    projectID   Integer    NOT NULL,
    CONSTRAINT  blobPk  PRIMARY KEY(blobID),
    CONSTRAINT  projectFk FOREIGN KEY(projectID)
        REFERENCES Project(projectID) ON DELETE CASCADE,
);

CREATE TABLE Blob_task_entity (
    blobID      Integer    NOT NULL,
    taskID      Integer    NOT NULL,
    CONSTRAINT  blobtaskPk  PRIMARY KEY(blobID, taskID),
    CONSTRAINT  blobFk FOREIGN KEY(blobID)
        REFERENCES Data_blob(blobID) ON DELETE CASCADE,
    CONSTRAINT  taskFk FOREIGN KEY(taskID)
        REFERENCES Project_task(taskID) ON DELETE CASCADE,
);
