import admin from "firebase-admin";

import * as fs from "fs";

import { PROBLEM_TIME } from "./data/problem_info.js"

const serviceAccount = JSON.parse(
    fs.readFileSync(
        './firebaseKey.json',
        { encoding: 'utf-8' }
    )
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const db = admin.firestore()

export async function getUser(uid) {
    const user = await db.collection("users").doc(uid).get()

    if (user.exists) {
        return user;
    } else {
        await db.collection("users").doc(uid).set({})
        return { data: () => ({}), id: user };
    }
}

export function checkIfStarted(user) {
    return user.started != undefined;
}

export function checkIfEnded(user) {
    if (typeof user.started == 'undefined') {
        return false;
    }

    if (typeof user.started != 'number') {
        return true;
    }

    const curTime = new Date().getTime()

    return (curTime - user.started) > PROBLEM_TIME;
}

export async function startTime(uid) {
    await db.collection("users").doc(uid).update({ started: new Date().getTime() })
}

export function checkAttempts(user, problem, maxAttempts) {
    return (user[`${problem}-attempts`] ?? 0) < maxAttempts
}

export async function updateAttemptsAndPoints(user, problem, points) {
    await db.collection("users").doc(user.id).update({ [problem]: points, [`${problem}-attempts`]: (user.data()[`${problem}-attempts`] ?? 0) + 1 })
}

export function calculateSecondsRemaining(user) {
    return (PROBLEM_TIME - new Date().getTime() + user.data().started)/1000;
}