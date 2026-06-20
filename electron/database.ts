import Database from 'better-sqlite3'

export function setupDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS robots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      model TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other',
      status TEXT NOT NULL DEFAULT 'idle',
      location TEXT NOT NULL,
      purchaseDate TEXT NOT NULL,
      totalUsageMinutes INTEGER NOT NULL DEFAULT 0,
      dailyUsageMinutes INTEGER NOT NULL DEFAULT 0,
      priorityScore REAL NOT NULL DEFAULT 1.0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS training_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patientName TEXT NOT NULL,
      patientIdCard TEXT NOT NULL,
      patientPhone TEXT NOT NULL,
      diagnosis TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      durationMinutes INTEGER NOT NULL,
      robotId INTEGER REFERENCES robots(id),
      status TEXT NOT NULL DEFAULT 'pending',
      actualStartTime TEXT,
      actualEndTime TEXT,
      actualDurationMinutes INTEGER,
      billId INTEGER,
      insuranceId INTEGER REFERENCES insurance_items(id),
      remark TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_schedules_time ON training_schedules(startTime, endTime);
    CREATE INDEX IF NOT EXISTS idx_schedules_status ON training_schedules(status);
    CREATE INDEX IF NOT EXISTS idx_schedules_robot ON training_schedules(robotId);

    CREATE TABLE IF NOT EXISTS billing_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      basePrice REAL NOT NULL DEFAULT 80,
      baseMinutes INTEGER NOT NULL DEFAULT 30,
      unitPricePerMinute REAL NOT NULL DEFAULT 2,
      maxPrice REAL NOT NULL DEFAULT 300,
      maxMinutes INTEGER NOT NULL DEFAULT 120,
      updatedAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheduleId INTEGER NOT NULL UNIQUE REFERENCES training_schedules(id),
      patientName TEXT NOT NULL,
      patientIdCard TEXT NOT NULL,
      robotId INTEGER NOT NULL REFERENCES robots(id),
      robotName TEXT NOT NULL,
      actualDurationMinutes INTEGER NOT NULL,
      basePrice REAL NOT NULL,
      extraPrice REAL NOT NULL,
      rawAmount REAL NOT NULL,
      finalAmount REAL NOT NULL,
      isCapped INTEGER NOT NULL DEFAULT 0,
      isBaseApplied INTEGER NOT NULL DEFAULT 0,
      insuranceId INTEGER REFERENCES insurance_items(id),
      insuranceName TEXT,
      insuranceDiscountRate REAL NOT NULL DEFAULT 0,
      insuranceDeductedAmount REAL NOT NULL DEFAULT 0,
      patientPayableAmount REAL NOT NULL DEFAULT 0,
      verifiedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_bills_patient ON bills(patientIdCard);
    CREATE INDEX IF NOT EXISTS idx_bills_created ON bills(createdAt);

    CREATE TABLE IF NOT EXISTS insurance_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      discountRate REAL NOT NULL DEFAULT 0,
      maxReimbursement REAL NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `)

  const ruleCount = db.prepare('SELECT COUNT(*) as cnt FROM billing_rules').get() as { cnt: number }
  if (ruleCount.cnt === 0) {
    db.prepare(`
      INSERT INTO billing_rules (basePrice, baseMinutes, unitPricePerMinute, maxPrice, maxMinutes)
      VALUES (80, 30, 2, 300, 120)
    `).run()
  }

  const robotCount = db.prepare('SELECT COUNT(*) as cnt FROM robots').get() as { cnt: number }
  if (robotCount.cnt === 0) {
    const insertRobot = db.prepare(`
      INSERT INTO robots (name, model, type, location, purchaseDate, priorityScore)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const seedRobots = [
      ['上肢康复机器人-A1', 'RehabArm-X1', 'upper_limb', '康复室A-01', '2024-06-15', 1.0],
      ['上肢康复机器人-A2', 'RehabArm-X1', 'upper_limb', '康复室A-02', '2024-06-15', 0.95],
      ['下肢康复机器人-B1', 'RehabLeg-Y2', 'lower_limb', '康复室B-01', '2024-07-20', 1.0],
      ['下肢康复机器人-B2', 'RehabLeg-Y2', 'lower_limb', '康复室B-02', '2024-07-20', 0.92],
      ['手部康复机器人-C1', 'RehabHand-Z1', 'hand', '康复室C-01', '2024-08-10', 1.0],
      ['平衡训练机器人-D1', 'RehabBalance-W1', 'balance', '康复室D-01', '2024-09-01', 1.0],
    ]
    const insertManyRobots = db.transaction((robots: any[][]) => {
      for (const r of robots) insertRobot.run(...r)
    })
    insertManyRobots(seedRobots)
  }

  const insuranceCount = db.prepare('SELECT COUNT(*) as cnt FROM insurance_items').get() as { cnt: number }
  if (insuranceCount.cnt === 0) {
    const insertInsurance = db.prepare(`
      INSERT INTO insurance_items (code, name, category, discountRate, maxReimbursement)
      VALUES (?, ?, ?, ?, ?)
    `)
    const seedInsurance = [
      ['REHAB001', '运动疗法', '康复治疗', 0.8, 200],
      ['REHAB002', '机器人辅助训练', '康复治疗', 0.7, 180],
      ['REHAB003', '平衡功能训练', '康复治疗', 0.75, 150],
      ['REHAB004', '手功能训练', '康复治疗', 0.85, 120],
    ]
    const insertManyInsurance = db.transaction((items: any[][]) => {
      for (const i of items) insertInsurance.run(...i)
    })
    insertManyInsurance(seedInsurance)
  }

  return db
}
