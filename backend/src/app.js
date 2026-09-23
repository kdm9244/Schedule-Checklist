require('dotenv').config({ override: true })

const express = require('express')
const cors = require('cors')
const session = require('express-session')

const authRouter = require('../router/authRouter')
const calendarRouter = require('../router/calendarRouter')
const userRouter = require('../router/userRouter')
const checklistRouter =require('../router/checklistRouter')
const memoRouter = require('../router/memoRouter')
const checklistTemplateRouter = require('../router/checklistTemplateRouter')
const checklistTemplateService = require('../service/checklistTemplateService')
const calendarPreferenceService = require('../service/calendarPreferenceService')
const checklistSchemaService = require('../service/checklistSchemaService')

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))

app.use(express.json())

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false
  }
}))

app.use('/auth', authRouter)
app.use('/api/calendar', calendarRouter)
app.use('/api/users', userRouter)
app.use('/api/checklists', checklistRouter)
app.use('/api/memos', memoRouter)
app.use('/api/checklist-templates', checklistTemplateRouter)

const PORT = process.env.PORT || 3000

// Warm the small settings schema during startup so the first Today request is not delayed by DDL.
checklistSchemaService.ensureSchema()
  .then(() => checklistTemplateService.ensureSchema())
  .catch(error => console.error('Checklist schema initialization failed:', error))
calendarPreferenceService.ensureSchema().catch(error => console.error('Calendar preference schema initialization failed:', error))

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
