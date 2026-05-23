# IPL Match Simulator

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=FFDF00)](https://vitejs.dev)
[![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)](https://www.chartjs.org)

An interactive, web-based simulation engine that models Indian Premier League (IPL) cricket matches using stochastic mathematical modeling. The application runs dynamic simulations using **Markov Chain State Transitions** to determine ball-by-ball outcomes based on realistic game parameters.

---
## Project Overview

This simulator provides a detailed simulation of T20 cricket matches, capturing the real-world variance, momentum shifts, and strategic decisions in an IPL match. Instead of purely random number generation, it models cricket as a series of discrete state changes, factoring in team profiles, match phases, and historical IPL performance metrics.

---
## Mathematical and Simulation Engine

The core simulation is built upon a **Discrete-Time Markov Chain (DTMC)**. Each ball represents a state transition from a set of batting-bowling conditions.

### State Space and Transitions
A state is defined by the tuple:
$$S = (\text{Runs}, \text{Wickets}, \text{Balls Bowled}, \text{Match Phase})$$

The outcome of each ball is modeled as a transition probability:
$$P(X_{n+1} = j \mid X_n = i)$$

Where the transition matrix $P$ dynamically shifts based on three primary dimensions:

### Match Phase

o **Powerplay (Overs 1-6)**: High boundary probability ($4$s and $6$s) accompanied by a moderately high risk of wickets, mimicking fielding restrictions.

o **Middle Overs (Overs 7-15)**: High probability of strike rotation ($1$s and $2$s), low risk of wickets, and lower boundary rate.

o **Death Overs (Overs 16-20)**: Maximum boundary attempt rate, resulting in a bimodal distribution of either maximum runs or high wicket frequencies.

### Team Profiles (Playstyle Matrix)

o **Aggressive**: Shifted probability distribution favoring high-value runs ($4$s and $6$s) but increases the transition probability to the "Wicket" state.

o **Balanced**: Standard distribution derived from historical tournament averages.

o **Conservative**: Higher probability of dot balls and singles, minimizing the likelihood of transitioning to a wicket state.

### Chasing Pressure (Dynamic Scaling)

o When simulating the second innings, the transition matrix dynamically adjusts based on the Required Run Rate ($RRR$). As $RRR$ increases, the probability matrix tilts toward high-risk, high-reward outcomes.

---

## Features

o **Interactive Configuration**: Select competing teams and set tactical profiles (Aggressive, Balanced, Conservative) before kick-off.

o **Ball-by-Ball Simulation**: Watch the match unfold in real-time with micro-animations, or skip directly to the end of an over/innings.

o **Real-time Live Charts**:

o **Worm Graph** (Live Chart): Cumulative run progression of both teams across 20 overs.

o **Run Rate Tracker** (Live Chart): Over-by-over run rate comparison.

o **Win Probability Index** (Live Chart): Dynamic win probability update based on remaining runs, balls, and wickets (calculated using simulated Monte Carlo outcomes).

o **Detailed Scorecard**: Fully formatted batting and bowling scorecards showing runs, balls faced, strike rates, overs, maidens, runs conceded, and wickets.

---

## Technical Stack

o **Frontend Framework**: React 18+ (Functional Components, Hooks)

o **Build System**: Vite (highly optimized, fast hot module replacement)

o **Data Visualization**: Chart.js / React-Chartjs-2

o **Styling**: Vanilla CSS (glassmorphism UI, custom variable themes, responsive grid layouts)

---

## Running the Simulator Locally

### Prerequisites

o Node.js (version 16 or higher)

o npm (Node Package Manager)

### Steps

#### 1. Clone the repository
```bash
git clone https://github.com/gargdev07/ipl-simulator.git
cd ipl-simulator
```

#### 2. Install dependencies
```bash
npm install
```

#### 3. Run the development server
```bash
npm run dev
```

#### 4. Open in browser
Navigate to the local URL provided by Vite (typically http://localhost:5173).
