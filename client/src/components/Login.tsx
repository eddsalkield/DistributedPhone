import * as React from 'react'

import * as api from "../API";

import Button from "./Button";
import Form, {FormData} from "./Form";
import FormError from "./FormError";
import InText from "./InText";

import './Login.css';

interface Props {
    controller: api.ClientState;
}
interface State {
    isSignUp: boolean;
    signingUp: boolean;
    loggingIn: boolean;
    loggingInAsGuest: boolean;
    loginError: string | null;
    signUpError: string | null;
}

export default class Login extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            isSignUp: true,
            signingUp: false,
            loggingIn: false,
            loggingInAsGuest: false,
            loginError: null,  
            signUpError: null,  
        }
    }

    onSignUp = (data: FormData) => {
        const password = data["password"] as string;
        if(data["password2"] !== password) {
            this.setState({
                signUpError: "Passwords do not match"
            });
            return;
        }

        this.setState({signingUp: true, signUpError: null});
        this.props.controller.signUp(data["email"] as string, password).then(() => {
            // nop?
        }, (e) => {
            this.setState({
                signingUp: false,
                signUpError: e.message
            });
        });
    };

    onLogin = (data: FormData) => {
        this.setState({loginError: null, loggingIn: true})
        this.props.controller.login(data["email"] as string, data["password"] as string).finally(() => {
        }).then(() => {
            // nop?
        }, (e) => {
            this.setState({
                loggingIn: false,
                loginError: e.message,
            });
        });
    };

    onGuestLogin = () => {
        this.setState({loginError: null, loggingInAsGuest: true})
        this.props.controller.loginGuest().finally(() => {
            // nop?
        }).catch((e) => {
            this.setState({
                loggingInAsGuest: false,
                signUpError: e.message,
            });
        });
    };

    setLogin = () => {
        this.setState({isSignUp: false});
    };

    render() {
        return <div className="Login">
            <h1>Put your Phone to Work</h1>
            <div className="section-split"><span>Will <em>you</em> join your phone to our botnet?</span></div>
            { this.state.isSignUp ?
                <Form className="Form-large" onSubmit={this.onSignUp}>
                    <h2>Sign up</h2>
                    <InText type="email" name="email" desc="Email" />
                    <InText type="password" name="password" desc="Password" />
                    <InText type="password" name="password2" desc="Confirm Password" />
                    <InText desc="Your mother's maiden name" />
                    <FormError error={this.state.signUpError} />
                    <Button type="submit">Sign Up</Button>
                    <Button type="button" onClick={this.onGuestLogin}>Enter as guest</Button>
                    <label className="Input">
                        <div>Already have an account? <a onClick={this.setLogin}>Log in</a></div>
                    </label>
                </Form>
            :
                <Form className="Form-large" onSubmit={this.onLogin}>
                    <h2>Log in</h2>
                    <InText type="email" name="email" desc="Email" />
                    <InText type="password" name="password" desc="Password" />
                    <FormError error={this.state.loginError} />
                    <Button type="submit" className={this.state.loggingIn ? "inprogress" : ""}>Log in</Button>
                </Form>
            }
        </div>;
    }
}
