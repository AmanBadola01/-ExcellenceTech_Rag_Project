import streamlit as st

import memory


def log_in(user_id: str, email: str):
    st.session_state["user_id"] = user_id
    st.session_state["email"] = email.strip().lower()
    st.session_state["session_id"] = memory.new_session_id()
    st.rerun()


def show_login():
    st.subheader("Please log in to continue")
    login_tab, signup_tab = st.tabs(["Login", "Sign up"])

    #Condition for log in 
    with login_tab:
        with st.form("login_form"):
            email = st.text_input("Email")
            password = st.text_input("Password", type="password")
            submitted = st.form_submit_button("Login")
        if submitted:
            user_id = memory.verify_user(email, password)
            if user_id:
                log_in(user_id, email)
            else:
                st.error("Wrong email or password.")

    # Condition for sign in 
    with signup_tab:
        with st.form("signup_form"):
            email = st.text_input("Email", key="signup_email")
            password = st.text_input("Password", type="password", key="signup_pw")
            confirm = st.text_input("Confirm password", type="password")
            submitted = st.form_submit_button("Create account")
        if submitted:
            if password != confirm:
                st.error("Passwords don't match.")
            else:
                user_id, error = memory.create_user(email, password)
                if error:
                    st.error(error)
                else:
                    log_in(user_id, email)
