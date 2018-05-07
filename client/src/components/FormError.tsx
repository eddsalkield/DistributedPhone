import * as React from 'react'

import "./Form.css";

interface Props {
    error: string | null;
}
interface State {
}

export default class FormError extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {};
    }

    render() {
        return <div className={"FormError" + (this.props.error === null ? "" : " FormError-error")}>
            {this.props.error === null ? null :
                <span>{this.props.error}</span>
            }
        </div>;
    }
}
