import streamlit as st
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
import os

# Function to create dataset for LSTM
def create_dataset(data, look_back=1):
    X, Y = [], []
    for i in range(len(data) - look_back - 1):
        a = data[i:(i + look_back), 0]
        X.append(a)
        Y.append(data[i + look_back, 0])
    return np.array(X), np.array(Y)

# Function to train and predict
def train_and_predict_streamlit(df):
    data = df["Production"].values.reshape(-1, 1)

    scaler = MinMaxScaler(feature_range=(0, 1))
    data_scaled = scaler.fit_transform(data)

    look_back = 3
    X, Y = create_dataset(data_scaled, look_back)

    X = np.reshape(X, (X.shape[0], X.shape[1], 1))

    model = Sequential()
    model.add(LSTM(50, input_shape=(look_back, 1)))
    model.add(Dense(1))
    model.compile(loss="mean_squared_error", optimizer="adam")

    model.fit(X, Y, epochs=100, batch_size=1, verbose=0)

    last_input = data_scaled[-look_back:].reshape(1, look_back, 1)
    predictions_scaled = []
    for _ in range(6):
        next_pred = model.predict(last_input)[0, 0]
        predictions_scaled.append(next_pred)
        last_input = np.append(last_input[:, 1:, :], [[next_pred]]).reshape(1, look_back, 1)

    predictions = scaler.inverse_transform(np.array(predictions_scaled).reshape(-1, 1))

    risks = []
    for pred in predictions:
        if pred < 50:
            risks.append("High Risk (Red)")
        elif pred < 80:
            risks.append("Medium Risk (Orange)")
        else:
            risks.append("Low Risk (Yellow)")

    return predictions.flatten(), risks

st.title("Oil AI: Oil & Gas Production Prediction")
st.write("Upload your production data (CSV) to predict future output and identify risks.")

uploaded_file = st.file_uploader("Choose a CSV file", type="csv")

if uploaded_file is not None:
    df = pd.read_csv(uploaded_file)
    st.subheader("Uploaded Data Preview")
    st.write(df.head())

    if "Production" not in df.columns:
        st.error("Error: The CSV file must contain a column named 'Production'.")
    else:
        st.subheader("Prediction Results")
        predicted_production, risk_alerts = train_and_predict_streamlit(df)

        prediction_df = pd.DataFrame({
            "Month": [f"Month {i+1}" for i in range(6)],
            "Predicted Production": predicted_production,
            "Risk Alert": risk_alerts
        })
        st.table(prediction_df)

        st.subheader("Risk Summary")
        for i, (prod, risk) in enumerate(zip(predicted_production, risk_alerts)):
            color = "red" if "High Risk" in risk else ("orange" if "Medium Risk" in risk else "green")
            st.markdown(f"<p style=\"color:{color};\">Month {i+1}: {prod:.2f} (Risk: {risk})</p>", unsafe_allow_html=True)


