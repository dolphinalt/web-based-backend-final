const problem_info = {
    "Disk Industry Secrets: KFC": {
        text: './data/problems/disk.md',
        answer: './data/problems/disk.csv',
        type: 'csv',
        maxAttempts: 8
    },
    "NOVA SERVICES": {
        text: './data/problems/NOVA.md',
        answer: './data/problems/NOVA.csv',
        caseSensitive: true,
        pointsEach: 0.2,
        type: 'csv',
        maxAttempts: 8
    },
    "OSINT": {
        text: './data/problems/OSINT.md',
        answer: './data/problems/OSINT.csv',
        caseSensitive: true,
        pointsEach: 1.6666667,
        type: 'csv',
        maxAttempts: 8
    },
    "TEST": {
        text: './data/problems/ONE.md',
        answer: './data/problems/ONE.txt',
        pointsEach: 20,
        type: 'text',
        maxAttempts: 2
    }
}

// 4 hours
const PROBLEM_TIME = 1.44e7;

export { problem_info, PROBLEM_TIME };
