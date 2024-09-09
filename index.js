import * as fs from 'fs'
import { problem_info } from './data/problem_info.js'
import express from 'express'
import { getUser, checkIfStarted, checkIfEnded, startTime, checkAttempts, updateAttemptsAndPoints, calculateSecondsRemaining } from './firebase-utils.js'
import cors from 'cors'
import { v4 as uuid } from 'uuid'

function roundToTwo(num) {
    return +(Math.round(num + "e+2")  + "e-2");
}

// set a password used for special endpoints
const pass = uuid()

// load users
const users = {}
const usersFile = fs.readFileSync('./data/users.csv', { encoding: 'utf-8' }).replaceAll("\r", "")
for (const user of usersFile.split("\n").slice(1)) {
    const [ email, alias, id, name ] = user.split(",")
    users[id] = {
        email,
        alias,
        name
    }
}

// load problem info
const upd_problem_info = {}
for (const problem in problem_info) {
    const text = fs.readFileSync(problem_info[problem].text, { encoding: 'utf-8' }).replaceAll("\r", "")
    const answerFile = fs.readFileSync(problem_info[problem].answer, { encoding: 'utf-8' }).replaceAll("\r", "")
    const type = problem_info[problem].type == 'csv' ? 'csv' : 'text';

    const answer = type == 'csv' ? csvToObject(answerFile) : answerFile;
    let availablePoints = 0;
    let pointsEach = 0;
    if (type == 'csv') {
        pointsEach = problem_info[problem].pointsEach || 1;
        for (let i in answer) {
            availablePoints += answer[i].length;
        }
        availablePoints = roundToTwo(availablePoints * pointsEach);
    } else {
        availablePoints = problem_info[problem].pointsEach;
        pointsEach = availablePoints;
    }

    upd_problem_info[problem] = {
        type,
        text,
        answer,
        availablePoints,
        caseSensitive: problem_info[problem].caseSensitive,
        maxAttempts: problem_info[problem].maxAttempts ?? 8,
        pointsEach
    }
}

// functions
async function checkAndGetUser(user) {
    if (!(user in users)) {
        return undefined;
    }

    return await getUser(user)
}

function csvToObject(txt) {
    const obj = {}
    for (const l of txt.split("\n").slice(1)) {
        const line = l.split(",")
        if (line.length > 1) {
            obj[line[0]] = line.slice(1);
        }
    }
    return obj
}

function calculatePoints(type, ans, check, caseSensitive, pointsEach) {
    if (type == 'csv') {
        let points = 0;
        let test = csvToObject(check);
        for (const key in ans) {
            if (key in test) {
                for (let i = 0; i < Math.min(ans[key].length, test[key].length); i++) {
                    if (caseSensitive) {
                        points += (ans[key][i] === test[key][i]) ? 1 : 0;
                    } else {
                        points += (ans[key][i]?.toLowerCase() === test[key][i]?.toLowerCase()) ? 1 : 0;
                    }
                }
            }
        }
        return roundToTwo(points * pointsEach);
    } else {
        if (caseSensitive) {
            return ans.trim() === check.trim() ? pointsEach : 0;
        }
        else {
            return ans.trim().toLowerCase() === check.trim().toLowerCase() ? pointsEach : 0;
        }
    }
}

// create app
const app = express()
app.use(express.json())
app.use(express.static('public'))
app.use(cors())

app.post('/test_user', async (req, res) => {
    const user = await checkAndGetUser(req.body.uid)

    if (!user) {
        res.status(400).json({ err: 'You have an invalid ID/user.' })
        return
    }

    if (!checkIfStarted(user.data())) {
        res.json({ err: 'Valid ID. You may now start your time.' })
        return
    }

    res.json({ err: 'You have already started your time!' })
})

app.post('/get_problems', async (req, res) => {
    const user = await checkAndGetUser(req.body.uid)
    if (!user) {
        res.status(400).json({ err: 'You have an invalid ID/user.' })
        return
    }

    if (!checkIfStarted(user.data())) {
        res.status(400).json({ err: 'You have not started your time.' })
        return
    }

    if (checkIfEnded(user.data())) {
        res.status(400).json({ err: 'Your time has been completed' })
        return
    }

    const problems = []
    for (let problemID in upd_problem_info) {
        const { availablePoints, maxAttempts } = upd_problem_info[problemID]
        problems.push({
            "name": problemID,
            "points": user.data()[problemID] ?? 0,
            "availablePoints": availablePoints,
            "attempts": maxAttempts - (user.data()[`${problemID}-attempts`] ?? 0)
        })
    }

    res.json({ problems: problems, seconds: calculateSecondsRemaining(user) })
})

app.post('/problem', async (req, res) => {
    const user = await checkAndGetUser(req.body.uid)
    if (!user) {
        res.status(400).json({ err: 'You have an invalid ID/user.' })
        return
    }

    if (!checkIfStarted(user.data())) {
        res.status(400).json({ err: 'You have not started your time.' })
        return
    }

    if (checkIfEnded(user.data())) {
        res.status(400).json({ err: 'Your time has been completed' })
        return
    }

    if (req.body.id in upd_problem_info) {
        const { text, availablePoints, maxAttempts } = upd_problem_info[req.body.id]
        res.json({ text, attempts: maxAttempts - (user.data()[`${req.body.id}-attempts`] ?? 0), availablePoints, points: user.data()[req.body.id] ?? 0 })
    } else {
        res.status(400).json({ err: 'Problem doesnt exist' })
    }
})

app.post('/submit', async (req, res) => {
    const user = await checkAndGetUser(req.body.uid)
    if (!user) {
        res.status(400).json({ err: 'You have an invalid ID/user.' })
        return
    }

    if (!checkIfStarted(user.data())) {
        res.status(400).json({ err: 'You have not started your time.' })
        return
    }

    if (checkIfEnded(user.data())) {
        res.status(400).json({ err: 'Your time has been completed' })
        return
    }

    if (req.body.id in upd_problem_info && req.body.csv) {
        if (!checkAttempts(user.data(), req.body.id, upd_problem_info[req.body.id].maxAttempts)) {
            res.status(400).json({ err: 'You have used up all your attempts' })
            return
        }

        const points = calculatePoints(upd_problem_info[req.body.id].type, upd_problem_info[req.body.id].answer, req.body.csv, upd_problem_info[req.body.id].caseSensitive, upd_problem_info[req.body.id].pointsEach)
        const attempts = (upd_problem_info[req.body.id].maxAttempts - 1) - (user.data()[`${req.body.id}-attempts`] ?? 0)

        await updateAttemptsAndPoints(user, req.body.id, points)

        res.json({ points, attempts, msg: `Problem completed for ${points} points. You have ${attempts} attempts left.` })
    } else {
        res.status(400).json({ err: 'Problem doesnt exist' })
    }
})

app.post('/start', async (req, res) => {
    const user = await checkAndGetUser(req.body.uid)

    if (!user) {
        res.status(400).json({ err: "You have an invalid ID/user." })
        return
    }
    
    if (checkIfEnded(user.data())) {
        res.status(400).json({ err: "Your time is up!" })
        return
    }

    if (checkIfStarted(user.data())) {
        res.status(400).json({ err: `You have already started. You have ${(calculateSecondsRemaining(user)/60).toFixed(1)} minutes remaining` })
        return
    }

    await startTime(req.body.uid);
    res.status(200).json({ err: false })
})

app.get('/export-'+pass, async (req, res) => {
    const problems = Object.keys(upd_problem_info)
    let csv = `email,full_name,${problems.join(",")},total\n`
    for (let user in users) {
        const dbUser = await checkAndGetUser(user)
        if (!dbUser) {
            continue;
        }

        csv += users[user].email + "," + users[user].name;
        let totalPoints = 0;

        for (let problem in upd_problem_info) {
            let points = 0;
            if (dbUser.data()[problem]) {
                points += dbUser.data()[problem];
            }
            csv += ',' + points;
            totalPoints += points;
        }

        csv += ',' + totalPoints;

        csv += '\n'
    }

    res.status(200).contentType('text/csv').send(csv)
})

app.get('/leaderboard-'+pass, async (req, res) => {
    let leaderboard = []
    for (let user in users) {
        const dbUser = await checkAndGetUser(user)
        if (!dbUser) {
            continue;
        }

        const alias = users[user].alias;
        let points = 0;

        for (let problem in upd_problem_info) {
            if (dbUser.data()[problem]) {
                points += dbUser.data()[problem];
            }
        }

        leaderboard.push({ alias, points })
    }

    leaderboard = leaderboard.sort((a, b) => b.points - a.points)
        
    res.status(200).json({items: leaderboard})
})

const PORT = process.env.PORT || 10001

// start app
app.listen(10001, '0.0.0.0', () => {
    console.log(`App started on ${PORT}`)
    console.log(`Export = /export-${pass}`)
    console.log(`Pass = ${pass}`)
})
