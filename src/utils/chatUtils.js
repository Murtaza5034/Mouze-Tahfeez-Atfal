import { db } from "../firebase/db";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export const addSystemMessage = async (roomId, text) => {
  if (!roomId || !text) return;
  try {
    await addDoc(collection(db, "tahfeez_messages", roomId, "messages"), {
      text,
      isSystemMessage: true,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Error adding system message:", err);
  }
};
