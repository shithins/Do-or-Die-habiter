migrate((app) => {
  // 1. Get habits collection
  const habits = app.findCollectionByNameOrId("habits");
  
  // 2. Add 'unit' text field to habits
  habits.fields.add(new TextField({
    name: "unit",
    required: false,
    min: 0,
    max: 20
  }));
  app.save(habits);

  // 3. Get completions collection
  const completions = app.findCollectionByNameOrId("completions");
  
  // 4. Add 'value' number field to completions
  completions.fields.add(new NumberField({
    name: "value",
    required: false
  }));
  app.save(completions);
}, (app) => {
  try {
    const habits = app.findCollectionByNameOrId("habits");
    habits.fields.removeByName("unit");
    app.save(habits);
  } catch (e) {}

  try {
    const completions = app.findCollectionByNameOrId("completions");
    completions.fields.removeByName("value");
    app.save(completions);
  } catch (e) {}
});
