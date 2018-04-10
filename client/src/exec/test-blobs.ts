import {b64Buf, strBuf} from "./test-util";

export const prog_echo = b64Buf(
    "AGFzbQEAAAABDQNgAX8AYAAAYAF/AX8CIQIDZW52Bm1lbW9yeQIAAgNlbnYLcHB0dzFfYWJvcnQA" +
    "AAMEAwECAgYOAn8AQaCIBAt/AEGSCAsHVAYLX19oZWFwX2Jhc2UDAApfX2RhdGFfZW5kAwEMcHB0" +
    "dzFfbWFsbG9jAAIKcHB0dzFfaW5pdAABDXBwdHcxX2NsZWFudXAAAQlwcHR3MV9ydW4AAwq4AQMD" +
    "AAELRwECf0GACEGACCgCACIBQQAgAGtBB3EgAGpqIgA2AgACQCAAQRB2IgA/ACICSwRAIAAgAmtA" +
    "AEF/Rg0BCyABDwtBhAgQAAALagEEfyAAKAIIQQN0QQxqEAIiASAAKQIANwIAIAEgACgCCDYCCCAA" +
    "KAIIBEAgAEEMaiECIAFBDGohAwNAIAMgAikCADcCACACQQhqIQIgA0EIaiEDIARBAWoiBCAAQQhq" +
    "KAIASQ0ACwsgAQsLHQIAQYAICwMgBAEAQYQICw1PdXQgb2YgbWVtb3J5"
);

export const prog_abort = b64Buf(
    "AGFzbQEAAAABDQNgAX8AYAAAYAF/AX8CIQIDZW52Bm1lbW9yeQIAAgNlbnYLcHB0dzFfYWJvcnQA" +
    "AAMEAwECAgYOAn8AQaCIBAt/AEGSCAsHVAYLX19oZWFwX2Jhc2UDAApfX2RhdGFfZW5kAwEMcHB0" +
    "dzFfbWFsbG9jAAIKcHB0dzFfaW5pdAABDXBwdHcxX2NsZWFudXAAAQlwcHR3MV9ydW4AAwpVAwMA" +
    "AQtHAQJ/QYAIQYAIKAIAIgFBACAAa0EHcSAAamoiADYCAAJAIABBEHYiAD8AIgJLBEAgACACa0AA" +
    "QX9GDQELIAEPC0GECBAAAAsHAEEAEAAACwsdAgBBgAgLAyAEAQBBhAgLDU91dCBvZiBtZW1vcnk="
);

export const hello_world = strBuf("Hello World!");