CREATE TABLE Customer (
    customerID   Integer    NOT NULL,
    customername Char(25)   NOT NULL,
    CONSTRAINT  customerPk  PRIMARY KEY(customerID)
);

CREATE TABLE Worker (
    workerID   Integer    NOT NULL,
    username   Char(25)   NOT NULL,
    password   Char(25)   NOT NULL,
    prefwifidata   Integer  DEFAULT 1,
    prefbattery    Integer  DEFAULT 1,
    CONSTRAINT  workerPk  PRIMARY KEY(workerID),
    CONSTRAINT  projectFk FOREIGN KEY(pID)
        REFERENCES Project(pID),
);

CREATE TABLE Project (
    pID   Integer    NOT NULL,
    pname Char(25)   NOT NULL,
    pdescription,
    customerID  Integer    NOT NULL,
    CONSTRAINT  projectPk  PRIMARY KEY(pID),
    CONSTRAINT  customerFk FOREIGN KEY(customerID)
        REFERENCES Customer(customerID) ON DELETE CASCADE,
);

CREATE TABLE Project_task (
    taskID      Integer    NOT NULL,
    task,
    pID   Integer    NOT NULL,
    workerID    Integer,
    CONSTRAINT  taskPk  PRIMARY KEY(taskID),
    CONSTRAINT  projectFk FOREIGN KEY(pID)
        REFERENCES Project(pID) ON DELETE CASCADE,
    CONSTRAINT  workerFk FOREIGN KEY(workerID)
        REFERENCES Worker(workerID) ON DELETE CASCADE,
);

CREATE TABLE Data_blob (
    blobID      Integer    NOT NULL,
    blob,
    metadata,
    pID   Integer    NOT NULL,
    CONSTRAINT  blobPk  PRIMARY KEY(blobID),
    CONSTRAINT  projectFk FOREIGN KEY(pID)
        REFERENCES Project(pID) ON DELETE CASCADE,
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

CREATE TABLE Completed_task (
    pID      Integer    NOT NULL,
    taskID      Integer    NOT NULL,
    blobs,
    blobmetadatas,
    CONSTRAINT  taskIDPk  PRIMARY KEY(taskID),
    CONSTRAINT  pIDFk FOREIGN KEY(pID)
        REFERENCES Project(pID) ON DELETE CASCADE
);
