import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import FloorPlanEditor from "./components/FloorPlanEditor";
import FloorPlan3D from "./components/FloorPlan3D";
import ResourceList from "./components/ResourceList";
import Checklist from "./components/Checklist";
import "./App.css";

const TABS = ["Floor Plan", "Resources", "Checklist"];

export default function App() {
  const [tab, setTab] = useState("Floor Plan");
  const [stageKey, setStageKey] = useState("current");
  const [dimension, setDimension] = useState("2D");
  const [stage, setStage] = useState(null);

  const reloadStage = useCallback(() => {
    api.getStage(stageKey).then(setStage);
  }, [stageKey]);

  useEffect(() => { reloadStage(); }, [reloadStage]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Garage &amp; Basement Planner</h1>
        <nav>
          {TABS.map((t) => (
            <button key={t} className={t === tab ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
      </header>

      <main>
        {tab === "Floor Plan" && (
          <div className="panel">
            <div className="panel-header">
              <h2>{stage ? stage.label : "Loading..."}</h2>
              <div className="header-controls">
                <div className="stage-toggle">
                  <button className={stageKey === "current" ? "active" : ""} onClick={() => setStageKey("current")}>
                    Current
                  </button>
                  <button className={stageKey === "redesign" ? "active" : ""} onClick={() => setStageKey("redesign")}>
                    Redesign
                  </button>
                </div>
                <div className="stage-toggle">
                  <button className={dimension === "2D" ? "active" : ""} onClick={() => setDimension("2D")}>
                    2D
                  </button>
                  <button className={dimension === "3D" ? "active" : ""} onClick={() => setDimension("3D")}>
                    3D
                  </button>
                </div>
              </div>
            </div>
            {dimension === "2D" ? (
              <FloorPlanEditor stage={stage} stageId={stage?.id} stageLabel={stage?.label} onFeaturesChanged={reloadStage} />
            ) : (
              <FloorPlan3D stage={stage} stageId={stage?.id} onFeaturesChanged={reloadStage} />
            )}
          </div>
        )}
        {tab === "Resources" && <ResourceList />}
        {tab === "Checklist" && <Checklist />}
      </main>
    </div>
  );
}
