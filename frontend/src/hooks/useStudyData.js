import { useEffect, useState } from "react";
import { seedData } from "../data/studyflow.js";

const STORAGE_KEY = "studyflow-data-v1";

function readData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.subjects && parsed.tasks && parsed.notes && parsed.sessions) return parsed;
    }
  } catch (error) {
    console.error("Could not load saved StudyFlow data.", error);
  }
  return seedData;
}

export default function useStudyData() {
  const [data, setData] = useState(readData);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Could not save StudyFlow data.", error);
    }
  }, [data]);

  return [data, setData];
}
