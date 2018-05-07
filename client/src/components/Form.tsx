import * as React from 'react'

import "./Form.css";

export interface FormData {
    [name:string]: string | boolean;
}

interface Props {
    className?: string;
    onSubmit?(data: FormData): void;
}
interface State {
}

export default class Form extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {};
    }

    onSubmit(ev: React.FormEvent<HTMLFormElement>, cb: ((data: FormData) => void) | undefined): void {
        ev.preventDefault();
        if(cb) {
            const data: FormData = {};
            const elements = (ev.target as HTMLFormElement).elements;
            for(let i = 0; i < elements.length; i += 1) {
                const cld = elements[i] as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
                const name = cld.name;
                if(cld.type === "checkbox") data[name] = (cld as HTMLInputElement).checked;
                else data[name] = cld.value;
            }
            cb(data);
        }
    }

    render() {
        const {className, onSubmit, children} = this.props;
        return <form
            className={(className || "") + " Form"}
            onSubmit={(ev) => this.onSubmit(ev, onSubmit)}
        >{children}</form>;
    }
}
