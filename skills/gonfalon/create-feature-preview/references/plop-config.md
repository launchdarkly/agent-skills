# Plop Generator Configuration

The feature preview generator is defined in `plopfile.mjs` at the root of the gonfalon repository.

## Generator Definition

```javascript
plop.setGenerator('feature-preview', {
  description: 'Create a new feature preview',
  prompts: [
    {
      type: 'input',
      name: 'name',
      message: 'What is the name of the feature preview?',
    },
    {
      type: 'input',
      name: 'description',
      message: 'Provide a brief description of the feature preview:',
    },
    {
      type: 'list',
      name: 'status',
      message: 'What is the status of the feature preview?',
      choices: ['Alpha', 'Beta', 'Stable'],
      default: 'Beta',
    },
    {
      type: 'input',
      name: 'feedbackUrl',
      message: 'Enter the feedback URL for the feature preview:',
      default: 'https://docs.google.com/forms/d/1CmhXMxioIb86OQXYpbPfBbQ7Mg0Pw_20cAZgJkEhri8/edit',
    },
    {
      type: 'input',
      name: 'imageName',
      message: 'Enter the image name for the feature preview (without file extension):',
    },
  ],
  actions: [
    {
      type: 'modify',
      path: 'packages/feature-previews/src/internal/availableFeaturePreviews.tsx',
      pattern: /(\/\/ IMPORTANT: The following comment is used by our code generation tools do not remove or modify this line\n)/,
      template: '$1\n  {{> feature-preview}},',
      templateFile: '.plop/templates/feature-preview.hbs',
    },
  ],
});
```

## Template File

Located at `.plop/templates/feature-preview.hbs`:

```handlebars
{
  id: '{{kebabCase name}}',
  name: '{{name}}',
  description: '{{description}}',
  imageUrl: {
    default: 'img/feature-previews/{{imageName}}.webp',
    dark: 'img/feature-previews/{{imageName}}-dark.webp',
  },
  status: '{{status}}',
  feedbackUrl: '{{feedbackUrl}}'
},
// IMPORTANT: The following comment is used by our code generation tools do not remove or modify this line
```

## How It Works

1. The generator uses the `modify` action type to insert new feature previews
2. It searches for the marker comment in `availableFeaturePreviews.tsx`
3. The new feature preview object is inserted before the marker comment
4. The marker comment is preserved for future generations

## Customization After Generation

The generated code uses string paths for images. For better type safety and bundling, you may want to:

1. Import images as modules
2. Add dogfood flag integration for gating
3. Add the `enabled` property if using a flag

See the main SKILL.md for examples of these customizations.
