migrate((app) => {
  // 1. Create habits collection
  const habits = new Collection({
    id: "habits_col_1234",
    name: "habits",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && user = @request.auth.id",
    updateRule: "@request.auth.id != '' && user = @request.auth.id",
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    fields: [
      {
        name: "name",
        type: "text",
        required: true,
        min: 1,
        max: 100
      },
      {
        name: "category",
        type: "text",
        required: true,
        min: 1,
        max: 50
      },
      {
        name: "user",
        type: "relation",
        required: true,
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1
      }
    ]
  });
  app.save(habits);

  // 2. Create completions collection
  const completions = new Collection({
    id: "compls_col_1234",
    name: "completions",
    type: "base",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != '' && habit.user = @request.auth.id",
    updateRule: "@request.auth.id != '' && habit.user = @request.auth.id",
    deleteRule: "@request.auth.id != '' && habit.user = @request.auth.id",
    indexes: [
      "CREATE UNIQUE INDEX idx_habit_date ON completions (habit, date)"
    ],
    fields: [
      {
        name: "habit",
        type: "relation",
        required: true,
        collectionId: "habits_col_1234",
        cascadeDelete: true,
        maxSelect: 1
      },
      {
        name: "date",
        type: "text",
        required: true,
        min: 10,
        max: 10,
        pattern: "^\\d{4}-\\d{2}-\\d{2}$"
      },
      {
        name: "note",
        type: "text",
        required: false,
        max: 500
      }
    ]
  });
  app.save(completions);

  // 3. Seed users
  const usersCollection = app.findCollectionByNameOrId("users");

  const shithin = new Record(usersCollection, {
    id: "shithinuser1234",
    username: "shithin",
    name: "Shithin",
    email: "shithin@example.com",
    password: "shithin1234",
    passwordConfirm: "shithin1234",
    verified: true
  });
  app.save(shithin);

  const vaisakh = new Record(usersCollection, {
    id: "vaisakhuser1234",
    username: "vaisakh",
    name: "Vaisakh",
    email: "vaisakh@example.com",
    password: "vaisakh1234",
    passwordConfirm: "vaisakh1234",
    verified: true
  });
  app.save(vaisakh);
}, (app) => {
  try {
    const completions = app.findCollectionByNameOrId("completions");
    app.delete(completions);
  } catch (e) {}

  try {
    const habits = app.findCollectionByNameOrId("habits");
    app.delete(habits);
  } catch (e) {}

  try {
    const shithin = app.findRecordById("users", "shithinuser1234");
    app.delete(shithin);
  } catch (e) {}

  try {
    const vaisakh = app.findRecordById("users", "vaisakhuser1234");
    app.delete(vaisakh);
  } catch (e) {}
});
