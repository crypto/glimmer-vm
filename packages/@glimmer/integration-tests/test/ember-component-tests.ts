import {
  AnnotatedModuleLocator,
  Option,
  RenderResult,
  Template,
  JitRuntimeContext,
  SyntaxCompilationContext,
} from '@glimmer/interfaces';
import EmberObject from '@glimmer/object';
import { CLASS_META, setProperty as set, UpdatableReference } from '@glimmer/object-reference';
import { bump } from '@glimmer/reference';
import { clientBuilder, renderJitMain } from '@glimmer/runtime';
import { assign, dict, unwrap } from '@glimmer/util';
import { SimpleElement } from '@simple-dom/interface';
import { assert } from './support';
import {
  TestContext,
  preprocess,
  assertElement,
  firstElementChild,
  JitTestContext,
  equalTokens,
  HookedComponent,
  ComponentHooks,
  equalsElement,
  classes,
  regex,
  registerEmberishCurlyComponent,
  EmberishCurlyComponent,
  registerBasicComponent,
  BasicComponent,
  stripTight,
  toInnerHTML,
  nextElementSibling,
  elementId,
  registerEmberishGlimmerComponent,
  registerModifier,
  inspectHooks,
  EmberishGlimmerComponent,
  assertElementShape,
  registerStaticTaglessComponent,
  registerTemplate,
  componentHelper,
} from '@glimmer/integration-tests';
import { EmberishGlimmerArgs } from '../lib/components';

let context: TestContext;

export class EmberishRootView extends EmberObject {
  public element!: SimpleElement;

  protected template: Template<AnnotatedModuleLocator>;
  protected result!: RenderResult;

  private parent!: SimpleElement;

  constructor(
    private runtime: JitRuntimeContext,
    private syntax: SyntaxCompilationContext,
    template: string,
    state?: Object
  ) {
    super(state);
    this.template = preprocess(template);
  }

  appendTo(selector: string) {
    let element = (this.parent = assertElement(document.querySelector(selector) as SimpleElement));
    let self = new UpdatableReference(this);
    let cursor = { element, nextSibling: null };

    let templateIterator = renderJitMain(
      this.runtime,
      this.syntax,
      self,
      clientBuilder(this.runtime.env, cursor),
      this.template.asLayout().compile(this.syntax)
    );
    let result;
    do {
      result = templateIterator.next();
    } while (!result.done);

    this.result = result.value!;

    this.element = firstElementChild(element)!;
  }

  rerender(context: Object | null = null) {
    if (context) {
      this.setProperties(context);
    }

    this.runtime.env.begin();
    this.result.rerender();
    this.runtime.env.commit();

    this.element = firstElementChild(this.parent)!;
  }

  destroy() {
    super.destroy();
    if (this.result) {
      this.result.destroy();
    }
  }
}

EmberishRootView[CLASS_META].seal();

let view: EmberishRootView;

function module(name: string) {
  QUnit.module(`[components] ${name}`, {
    beforeEach() {
      context = JitTestContext();
    },
  });
}

export function appendViewFor(template: string, state: Object = {}) {
  view = new EmberishRootView(context.runtime, context.syntax, template, state);

  context.env.begin();
  view.appendTo('#qunit-fixture');
  context.env.commit();

  return view;
}

export function assertAppended(content: string) {
  equalTokens(document.querySelector('#qunit-fixture') as Option<SimpleElement>, content);
}

function assertText(expected: string) {
  let rawText = (document.querySelector('#qunit-fixture') as HTMLElement).innerText;
  let text = rawText
    .split(/[\r\n]/g)
    .map(part => {
      let p = part.replace(/\s+/g, ' ');
      return p.trim();
    })
    .filter(part => part !== '')
    .join(' ');
  QUnit.assert.strictEqual(text, expected, `#qunit-fixture content should be: \`${expected}\``);
}

function assertFired(component: HookedComponent, name: string, count = 1) {
  let hooks = component.hooks;

  if (!hooks) {
    throw new TypeError('Not hooked: ' + component);
  }

  if (name in hooks) {
    assert.strictEqual(
      hooks[name as keyof ComponentHooks],
      count,
      `The ${name} hook fired ${count} ${count === 1 ? 'time' : 'times'}`
    );
  } else {
    assert.ok(false, `The ${name} hook fired`);
  }
}

function assertEmberishElement(tagName: string, attrs: Object, contents: string): void;
function assertEmberishElement(tagName: string, attrs: Object): void;
function assertEmberishElement(tagName: string, contents: string): void;
function assertEmberishElement(tagName: string): void;
function assertEmberishElement(...args: any[]): void {
  let tagName, attrs, contents;
  if (args.length === 2) {
    if (typeof args[1] === 'string') [tagName, attrs, contents] = [args[0], {}, args[1]];
    else [tagName, attrs, contents] = [args[0], args[1], null];
  } else if (args.length === 1) {
    [tagName, attrs, contents] = [args[0], {}, null];
  } else {
    [tagName, attrs, contents] = args;
  }

  let fullAttrs = assign({ class: classes('ember-view'), id: regex(/^ember\d*$/) }, attrs);
  equalsElement(view.element, tagName, fullAttrs, contents);
}

export function assertElementIsEmberishElement(
  element: SimpleElement | null,
  tagName: string,
  attrs: Object,
  contents: string
): void;
export function assertElementIsEmberishElement(
  element: SimpleElement | null,
  tagName: string,
  attrs: Object
): void;
export function assertElementIsEmberishElement(
  element: SimpleElement | null,
  tagName: string,
  contents: string
): void;
export function assertElementIsEmberishElement(
  element: SimpleElement | null,
  tagName: string
): void;
export function assertElementIsEmberishElement(
  element: SimpleElement | null,
  ...args: any[]
): void {
  let tagName, attrs, contents;
  if (args.length === 2) {
    if (typeof args[1] === 'string') [tagName, attrs, contents] = [args[0], {}, args[1]];
    else [tagName, attrs, contents] = [args[0], args[1], null];
  } else if (args.length === 1) {
    [tagName, attrs, contents] = [args[0], {}, null];
  } else {
    [tagName, attrs, contents] = args;
  }

  let fullAttrs = assign({ class: classes('ember-view'), id: regex(/^ember\d*$/) }, attrs);
  equalsElement(element, tagName, fullAttrs, contents);
}

function rerender() {
  bump();
  view.rerender();
}

module('Manager#create - hasBlock');

QUnit.test('when no block present', () => {
  class FooBar extends EmberishCurlyComponent {
    tagName = 'div';
  }

  registerEmberishCurlyComponent(context.registry, 'foo-bar', FooBar, `{{HAS_BLOCK}}`);

  appendViewFor(`{{foo-bar}}`);

  assertEmberishElement('div', {}, `false`);
});

QUnit.test('when block present', () => {
  class FooBar extends EmberishCurlyComponent {
    tagName = 'div';
  }

  registerEmberishCurlyComponent(context.registry, 'foo-bar', FooBar, `{{HAS_BLOCK}}`);

  appendViewFor(`{{#foo-bar}}{{/foo-bar}}`);

  assertEmberishElement('div', {}, `true`);
});

module('Components - curlies - dynamic component');

QUnit.test('initially missing, then present, then missing', () => {
  registerBasicComponent(context.registry, 'FooBar', BasicComponent, `<p>{{@arg1}}</p>`);

  appendViewFor(
    stripTight`
      <div>
        {{component something arg1="hello"}}
      </div>`,
    {
      something: undefined,
    }
  );

  equalsElement(view.element, 'div', {}, '<!---->');

  set(view, 'something', 'FooBar');
  rerender();

  equalsElement(view.element, 'div', {}, '<p>hello</p>');

  set(view, 'something', undefined);
  rerender();

  equalsElement(view.element, 'div', {}, '<!---->');
});

QUnit.test('initially present, then missing, then present', () => {
  registerBasicComponent(context.registry, 'FooBar', BasicComponent, `<p>foo bar baz</p>`);

  appendViewFor(
    stripTight`
      <div>
        {{component something}}
      </div>`,
    {
      something: 'FooBar',
    }
  );

  equalsElement(view.element, 'div', {}, '<p>foo bar baz</p>');

  set(view, 'something', undefined);
  rerender();

  equalsElement(view.element, 'div', {}, '<!---->');

  set(view, 'something', 'FooBar');
  rerender();

  equalsElement(view.element, 'div', {}, '<p>foo bar baz</p>');
});

module('Components - curlies - dynamic customizations');

QUnit.test('dynamic tagName', () => {
  class FooBar extends EmberishCurlyComponent {
    tagName = 'aside';
  }

  registerEmberishCurlyComponent(context.registry, 'foo-bar', FooBar, `Hello. It's me.`);

  appendViewFor(`{{foo-bar}}`);
  assertEmberishElement('aside', {}, `Hello. It's me.`);

  rerender();

  assertEmberishElement('aside', {}, `Hello. It's me.`);
});

QUnit.test('dynamic tagless component', () => {
  class FooBar extends EmberishCurlyComponent {
    tagName = '';
  }

  registerEmberishCurlyComponent(
    context.registry,
    'foo-bar',
    FooBar,
    `Michael Jordan says "Go Tagless"`
  );

  appendViewFor(`{{foo-bar}}`);
  assertAppended('Michael Jordan says "Go Tagless"');

  rerender();

  assertAppended('Michael Jordan says "Go Tagless"');
});

QUnit.test('dynamic attribute bindings', assert => {
  let fooBarInstance: FooBar | undefined;

  class FooBar extends EmberishCurlyComponent {
    attributeBindings = ['style'];
    style: string | null = null;

    constructor() {
      super();
      this.style = 'color: red;';
      fooBarInstance = this;
    }
  }

  registerEmberishCurlyComponent(context.registry, 'foo-bar', FooBar, `Hello. It's me.`);

  appendViewFor(`{{foo-bar}}`);
  assertEmberishElement('div', { style: 'color: red;' }, `Hello. It's me.`);

  rerender();

  assert.ok(fooBarInstance, 'expected foo-bar to be set');

  if (fooBarInstance === undefined) {
    return;
  }

  assertEmberishElement('div', { style: 'color: red;' }, `Hello. It's me.`);

  fooBarInstance.style = 'color: green;';
  rerender();

  assertEmberishElement('div', { style: 'color: green;' }, `Hello. It's me.`);

  fooBarInstance.style = null;
  rerender();

  assertEmberishElement('div', {}, `Hello. It's me.`);

  fooBarInstance.style = 'color: red;';
  rerender();

  assertEmberishElement('div', { style: 'color: red;' }, `Hello. It's me.`);
});

module('Components - generic - attrs');

QUnit.test('using @value from emberish curly component', () => {
  class FooBar extends EmberishCurlyComponent {
    static positionalParams = ['foo'];
    tagName = 'div';
  }

  registerEmberishCurlyComponent(context.registry, 'foo-bar', FooBar, `{{@blah}}`);

  appendViewFor(`{{foo-bar first blah="derp"}}`);

  assertEmberishElement('div', {}, `derp`);
});

module('Components - integration - scope');

QUnit.test('correct scope - accessing local variable in yielded block (glimmer component)', () => {
  class FooBar extends BasicComponent {}

  registerBasicComponent(
    context.registry,
    'FooBar',
    FooBar,
    `<div>[Layout: {{zomg}}][Layout: {{lol}}][Layout: {{@foo}}]{{yield}}</div>`
  );

  appendViewFor(
    stripTight`
      <div>
        [Outside: {{zomg}}]
        {{#with zomg as |lol|}}
          [Inside: {{zomg}}]
          [Inside: {{lol}}]
          <FooBar @foo={{zomg}}>
            [Block: {{zomg}}]
            [Block: {{lol}}]
          </FooBar>
        {{/with}}
      </div>`,
    { zomg: 'zomg' }
  );

  equalsElement(
    view.element,
    'div',
    {},
    stripTight`
        [Outside: zomg]
        [Inside: zomg]
        [Inside: zomg]
        <div>
          [Layout: ]
          [Layout: ]
          [Layout: zomg]
          [Block: zomg]
          [Block: zomg]
        </div>`
  );
});

QUnit.test('correct scope - accessing local variable in yielded block (curly component)', () => {
  class FooBar extends EmberishCurlyComponent {
    public tagName = '';
  }

  registerEmberishCurlyComponent(
    context.registry,
    'foo-bar',
    FooBar,
    `[Layout: {{zomg}}][Layout: {{lol}}][Layout: {{foo}}]{{yield}}`
  );

  appendViewFor(
    stripTight`
      <div>
        [Outside: {{zomg}}]
        {{#with zomg as |lol|}}
          [Inside: {{zomg}}]
          [Inside: {{lol}}]
          {{#foo-bar foo=zomg}}
            [Block: {{zomg}}]
            [Block: {{lol}}]
          {{/foo-bar}}
        {{/with}}
      </div>`,
    { zomg: 'zomg' }
  );

  equalsElement(
    view.element,
    'div',
    {},
    stripTight`
        [Outside: zomg]
        [Inside: zomg]
        [Inside: zomg]
        [Layout: ]
        [Layout: ]
        [Layout: zomg]
        [Block: zomg]
        [Block: zomg]`
  );
});

QUnit.test('correct scope - caller self can be threaded through (curly component)', () => {
  // demonstrates ability for Ember to know the target object of curly component actions
  class Base extends EmberishCurlyComponent {
    public tagName = '';
  }
  class FooBar extends Base {
    public name = 'foo-bar';
  }

  class QuxDerp extends Base {
    public name = 'qux-derp';
  }

  registerEmberishCurlyComponent(
    context.registry,
    'foo-bar',
    FooBar,
    stripTight`
    [Name: {{name}} | Target: {{targetObject.name}}]
    {{#qux-derp}}
      [Name: {{name}} | Target: {{targetObject.name}}]
    {{/qux-derp}}
    [Name: {{name}} | Target: {{targetObject.name}}]
  `
  );

  registerEmberishCurlyComponent(
    context.registry,
    'qux-derp',
    QuxDerp,
    `[Name: {{name}} | Target: {{targetObject.name}}]{{yield}}`
  );

  appendViewFor(`<div>{{foo-bar}}</div>`, {
    name: 'outer-scope',
  });

  equalsElement(
    view.element,
    'div',
    {},
    stripTight`
        [Name: foo-bar | Target: outer-scope]
        [Name: qux-derp | Target: foo-bar]
        [Name: foo-bar | Target: outer-scope]
        [Name: foo-bar | Target: outer-scope]
        `
  );
});

QUnit.test('`false` class name do not render', assert => {
  appendViewFor('<div class={{isFalse}}>FALSE</div>', { isFalse: false });
  assert.strictEqual(view.element.getAttribute('class'), null);
});

QUnit.test('`null` class name do not render', assert => {
  appendViewFor('<div class={{isNull}}>NULL</div>', { isNull: null });
  assert.strictEqual(view.element.getAttribute('class'), null);
});

QUnit.test('`undefined` class name do not render', assert => {
  appendViewFor('<div class={{isUndefined}}>UNDEFINED</div>', { isUndefined: undefined });
  assert.strictEqual(view.element.getAttribute('class'), null);
});

QUnit.test('`0` class names do render', assert => {
  appendViewFor('<div class={{isZero}}>ZERO</div>', { isZero: 0 });
  assert.strictEqual(view.element.getAttribute('class'), '0');
});

QUnit.test('component with slashed name', assert => {
  let SampleComponent = EmberishCurlyComponent;

  registerEmberishCurlyComponent(
    context.registry,
    'fizz-bar/baz-bar',
    SampleComponent as any,
    '{{@hey}}'
  );

  appendViewFor('{{fizz-bar/baz-bar hey="hello"}}');

  assert.equal(toInnerHTML(view.element), 'hello');
});

QUnit.test('correct scope - simple', () => {
  registerBasicComponent(context.registry, 'SubItem', BasicComponent, `<p>{{@name}}</p>`);

  let subitems = [{ id: 0 }, { id: 1 }, { id: 42 }];

  appendViewFor(
    stripTight`
      <div>
        {{#each items key="id" as |item|}}
          <SubItem @name={{item.id}} />
        {{/each}}
      </div>`,
    { items: subitems }
  );

  equalsElement(view.element, 'div', {}, '<p>0</p><p>1</p><p>42</p>');
});

QUnit.test('correct scope - self lookup inside #each', () => {
  registerBasicComponent(context.registry, 'SubItem', BasicComponent, `<p>{{@name}}</p>`);

  let subitems = [{ id: 0 }, { id: 1 }, { id: 42 }];

  appendViewFor(
    stripTight`
      <div>
        {{#each items key="id" as |item|}}
          <SubItem @name={{this.id}} />
          <SubItem @name={{id}} />
          <SubItem @name={{item.id}} />
        {{/each}}
      </div>`,
    { items: subitems, id: '(self)' }
  );

  equalsElement(
    view.element,
    'div',
    {},
    stripTight`
    <p>(self)</p><p>(self)</p><p>0</p>
    <p>(self)</p><p>(self)</p><p>1</p>
    <p>(self)</p><p>(self)</p><p>42</p>`
  );
});

QUnit.test('correct scope - complex', () => {
  registerBasicComponent(context.registry, 'SubItem', BasicComponent, `<p>{{@name}}</p>`);

  registerBasicComponent(
    context.registry,
    'MyItem',
    BasicComponent,
    stripTight`
      <aside>{{@item.id}}:
        {{#if @item.visible}}
          {{#each @item.subitems key="id" as |subitem|}}
             <SubItem @name={{subitem.id}} />
          {{/each}}
        {{/if}}
      </aside>`
  );

  let itemId = 0;

  let items = [];

  for (let i = 0; i < 3; i++) {
    let subitems = [];
    let subitemId = 0;

    for (let j = 0; j < 2; j++) {
      subitems.push({
        id: `${itemId}.${subitemId++}`,
      });
    }

    items.push({
      id: String(itemId++),
      visible: i % 2 === 0,
      subitems,
    });
  }

  appendViewFor(
    stripTight`
        <article>{{#each items key="id" as |item|}}
          <MyItem @item={{item}} />
        {{/each}}</article>`,
    { items }
  );

  equalsElement(
    view.element,
    'article',
    {},
    stripTight`
        <aside>0:<p>0.0</p><p>0.1</p></aside>
        <aside>1:<!----></aside>
        <aside>2:<p>2.0</p><p>2.1</p></aside>`
  );
});

QUnit.test('correct scope - complex yield', () => {
  registerEmberishCurlyComponent(
    context.registry,
    'item-list',
    EmberishCurlyComponent as any,
    stripTight`
      <ul>
        {{#each items key="id" as |item|}}
          <li>{{item.id}}: {{yield item}}</li>
        {{/each}}
      </ul>`
  );

  let items = [
    { id: '1', name: 'Foo', description: 'Foo!' },
    { id: '2', name: 'Bar', description: 'Bar!' },
    { id: '3', name: 'Baz', description: 'Baz!' },
  ];

  appendViewFor(
    stripTight`
      {{#item-list items=items as |item|}}
        {{item.name}}{{#if showDescription}} - {{item.description}}{{/if}}
      {{/item-list}}`,
    { items, showDescription: false }
  );

  assertEmberishElement(
    'div',
    stripTight`
      <ul>
        <li>1: Foo<!----></li>
        <li>2: Bar<!----></li>
        <li>3: Baz<!----></li>
      </ul>`
  );

  view.rerender({ items, showDescription: true });

  assertEmberishElement(
    'div',
    stripTight`
      <ul>
        <li>1: Foo - Foo!</li>
        <li>2: Bar - Bar!</li>
        <li>3: Baz - Baz!</li>
      </ul>`
  );
});

QUnit.test('correct scope - self', () => {
  class FooBar extends BasicComponent {
    public foo = 'foo';
    public bar = 'bar';
  }

  registerBasicComponent(context.registry, 'FooBar', FooBar, `<p>{{foo}} {{bar}} {{@baz}}</p>`);

  appendViewFor(
    stripTight`
      <div>
        <FooBar />
        <FooBar @baz={{zomg}} />
      </div>`,
    { zomg: 'zomg' }
  );

  equalsElement(
    view.element,
    'div',
    {},
    stripTight`
        <p>foo bar </p>
        <p>foo bar zomg</p>`
  );
});

module('Curly Components - smoke test dynamicScope access');

QUnit.test('component has access to dynamic scope', function() {
  class SampleComponent extends EmberishCurlyComponent {
    static fromDynamicScope = ['theme'];
  }

  registerEmberishCurlyComponent(
    context.registry,
    'sample-component',
    SampleComponent,
    '{{theme}}'
  );

  appendViewFor('{{#-with-dynamic-vars theme="light"}}{{sample-component}}{{/-with-dynamic-vars}}');

  assertEmberishElement('div', 'light');
});

module('Curly Components - positional arguments');

QUnit.test('static named positional parameters', function() {
  class SampleComponent extends EmberishCurlyComponent {
    static positionalParams = ['person', 'age'];
  }

  registerEmberishCurlyComponent(
    context.registry,
    'sample-component',
    SampleComponent,
    '{{person}}{{age}}'
  );

  appendViewFor('{{sample-component "Quint" 4}}');

  assertEmberishElement('div', 'Quint4');
});

QUnit.test('dynamic named positional parameters', function() {
  class SampleComponent extends EmberishCurlyComponent {
    static positionalParams = ['person', 'age'];
  }

  registerEmberishCurlyComponent(
    context.registry,
    'sample-component',
    SampleComponent,
    '{{person}}{{age}}'
  );

  appendViewFor('{{sample-component myName myAge}}', {
    myName: 'Quint',
    myAge: 4,
  });

  assertEmberishElement('div', 'Quint4');

  set(view, 'myName', 'Edward');
  set(view, 'myAge', 5);
  rerender();

  assertEmberishElement('div', 'Edward5');
});

QUnit.test(
  'if a value is passed as a non-positional parameter, it takes precedence over the named one',
  assert => {
    class SampleComponent extends EmberishCurlyComponent {
      static positionalParams = ['name'];
    }

    registerEmberishCurlyComponent(
      context.registry,
      'sample-component',
      SampleComponent as any,
      '{{name}}'
    );

    assert.throws(() => {
      appendViewFor('{{sample-component notMyName name=myName}}', {
        myName: 'Quint',
        notMyName: 'Sergio',
      });
    }, 'You cannot specify both a positional param (at position 0) and the hash argument `name`.');
  }
);

QUnit.test('static arbitrary number of positional parameters', function() {
  class SampleComponent extends EmberishCurlyComponent {
    static positionalParams = ['names'];
  }

  registerEmberishCurlyComponent(
    context.registry,
    'sample-component',
    SampleComponent as any,
    '{{#each names key="@index" as |name|}}{{name}}{{/each}}'
  );

  appendViewFor(
    stripTight`<div>{{sample-component "Foo" 4 "Bar"}}
      {{sample-component "Foo" 4 "Bar" 5 "Baz"}}
      {{!sample-component "Foo" 4 "Bar" 5 "Baz"}}</div>`
  );

  let first = assertElement(view.element.firstChild);
  let second = assertElement(first.nextSibling);
  // let third = <Element>second.nextSibling;

  assertElementIsEmberishElement(first, 'div', 'Foo4Bar');
  assertElementIsEmberishElement(second, 'div', 'Foo4Bar5Baz');
  // equalsElement(third, ...emberishElement('div', { id: 'helper' }, 'Foo4Bar5Baz'));
});

QUnit.test('arbitrary positional parameter conflict with hash parameter is reported', assert => {
  class SampleComponent extends EmberishCurlyComponent {
    static positionalParams = ['names'];
  }

  registerEmberishCurlyComponent(
    context.registry,
    'sample-component',
    SampleComponent as any,
    '{{#each attrs.names key="@index" as |name|}}{{name}}{{/each}}'
  );

  assert.throws(function() {
    appendViewFor('{{sample-component "Foo" 4 "Bar" names=numbers id="args-3"}}', {
      numbers: [1, 2, 3],
    });
  }, `You cannot specify positional parameters and the hash argument \`names\`.`);
});

QUnit.test('can use hash parameter instead of arbitrary positional param [GH #12444]', function() {
  class SampleComponent extends EmberishCurlyComponent {
    static positionalParams = ['names'];
  }

  registerEmberishCurlyComponent(
    context.registry,
    'sample-component',
    SampleComponent as any,
    '{{#each names key="@index" as |name|}}{{name}}{{/each}}'
  );

  appendViewFor('{{sample-component names=things}}', {
    things: ['Foo', 4, 'Bar'],
  });

  assertEmberishElement('div', 'Foo4Bar');
});

QUnit.test('can use hash parameter instead of positional param', function() {
  class SampleComponent extends EmberishCurlyComponent {
    static positionalParams = ['first', 'second'];
  }

  registerEmberishCurlyComponent(
    context.registry,
    'sample-component',
    SampleComponent as any,
    '{{first}} - {{second}}'
  );

  appendViewFor(
    `<div>
    {{sample-component "one" "two"}}
    {{sample-component "one" second="two"}}
    {{sample-component first="one" second="two"}}</div>
  `,
    {
      things: ['Foo', 4, 'Bar'],
    }
  );

  let first = unwrap(firstElementChild(view.element));
  let second = unwrap(nextElementSibling(first));
  let third = nextElementSibling(second);

  assertElementIsEmberishElement(first, 'div', 'one - two');
  assertElementIsEmberishElement(second, 'div', 'one - two');
  assertElementIsEmberishElement(third, 'div', 'one - two');
});

QUnit.test('dynamic arbitrary number of positional parameters', function() {
  class SampleComponent extends EmberishCurlyComponent {
    static positionalParams = ['n'];
  }

  registerEmberishCurlyComponent(
    context.registry,
    'sample-component',
    SampleComponent as any,
    '{{#each attrs.n key="@index" as |name|}}{{name}}{{/each}}'
  );

  appendViewFor(
    '<div>{{sample-component user1 user2}}{{!component "sample-component" user1 user2}}</div>',
    {
      user1: 'Foo',
      user2: 4,
    }
  );

  let first = firstElementChild(view.element);
  // let second = first.nextElementSibling;

  assertElementIsEmberishElement(first, 'div', 'Foo4');
  // assertElementIsEmberishElement(first, 'div', 'Foo4');

  set(view, 'user1', 'Bar');
  set(view, 'user2', '5');
  rerender();

  assertElementIsEmberishElement(first, 'div', 'Bar5');
  // assertElementIsEmberishElement(second, 'div', 'Bar5');

  set(view, 'user2', '6');
  rerender();

  assertElementIsEmberishElement(first, 'div', 'Bar6');
  // assertElementIsEmberishElement(second, 'div', 'Bar6');
});

QUnit.test('{{component}} helper works with positional params', function() {
  class SampleComponent extends EmberishCurlyComponent {
    static positionalParams = ['name', 'age'];
  }

  registerEmberishCurlyComponent(
    context.registry,
    'sample-component',
    SampleComponent as any,
    `{{attrs.name}}{{attrs.age}}`
  );

  appendViewFor(`{{component "sample-component" myName myAge}}`, {
    myName: 'Quint',
    myAge: 4,
  });

  assertEmberishElement('div', 'Quint4');

  set(view, 'myName', 'Edward');
  set(view, 'myAge', '5');
  rerender();

  assertEmberishElement('div', 'Edward5');

  set(view, 'myName', 'Quint');
  set(view, 'myAge', '4');
  rerender();

  assertEmberishElement('div', 'Quint4');
});

module('Emberish closure components');

QUnit.test('component helper can handle aliased block components with args', () => {
  registerEmberishCurlyComponent(context.registry, 'foo-bar', null, 'Hello {{arg1}} {{yield}}');

  appendViewFor(
    stripTight`
      {{#with (hash comp=(component 'foo-bar')) as |my|}}
        {{#component my.comp arg1="World!"}}Test1{{/component}} Test2
      {{/with}}
    `
  );

  assertText('Hello World! Test1 Test2');
});

QUnit.test('component helper can handle aliased block components without args', () => {
  registerEmberishCurlyComponent(context.registry, 'foo-bar', null, 'Hello {{yield}}');

  appendViewFor(
    stripTight`
      {{#with (hash comp=(component 'foo-bar')) as |my|}}
        {{#component my.comp}}World!{{/component}} Test
      {{/with}}
    `
  );

  assertText('Hello World! Test');
});

QUnit.test('component helper can handle aliased inline components with args', () => {
  registerEmberishCurlyComponent(context.registry, 'foo-bar', null, 'Hello {{arg1}}');

  appendViewFor(
    stripTight`
      {{#with (hash comp=(component 'foo-bar')) as |my|}}
        {{component my.comp arg1="World!"}} Test
      {{/with}}
    `
  );

  assertText('Hello World! Test');
});

QUnit.test('component helper can handle aliased inline components without args', () => {
  registerEmberishCurlyComponent(context.registry, 'foo-bar', null, 'Hello');

  appendViewFor(
    stripTight`
      {{#with (hash comp=(component 'foo-bar')) as |my|}}
        {{component my.comp}} World!
      {{/with}}
    `
  );

  assertText('Hello World!');
});

QUnit.test('component helper can handle higher order inline components with args', () => {
  registerEmberishCurlyComponent(
    context.registry,
    'foo-bar',
    null,
    '{{yield (hash comp=(component "baz-bar"))}}'
  );
  registerEmberishCurlyComponent(context.registry, 'baz-bar', null, 'Hello {{arg1}}');

  appendViewFor(
    stripTight`
      {{#foo-bar as |my|}}
        {{component my.comp arg1="World!"}} Test
      {{/foo-bar}}
    `
  );

  assertText('Hello World! Test');
});

QUnit.test('component helper can handle higher order inline components without args', () => {
  registerEmberishCurlyComponent(
    context.registry,
    'foo-bar',
    null,
    '{{yield (hash comp=(component "baz-bar"))}}'
  );
  registerEmberishCurlyComponent(context.registry, 'baz-bar', null, 'Hello');

  appendViewFor(
    stripTight`
      {{#foo-bar as |my|}}
        {{component my.comp}} World!
      {{/foo-bar}}
    `
  );

  assertText('Hello World!');
});

QUnit.test('component helper can handle higher order block components with args', () => {
  registerEmberishCurlyComponent(
    context.registry,
    'foo-bar',
    null,
    '{{yield (hash comp=(component "baz-bar"))}}'
  );
  registerEmberishCurlyComponent(context.registry, 'baz-bar', null, 'Hello {{arg1}} {{yield}}');

  appendViewFor(
    stripTight`
      {{#foo-bar as |my|}}
        {{#component my.comp arg1="World!"}}Test1{{/component}} Test2
      {{/foo-bar}}
    `
  );

  assertText('Hello World! Test1 Test2');
});

QUnit.test('component helper can handle higher order block components without args', () => {
  registerEmberishCurlyComponent(
    context.registry,
    'foo-bar',
    null,
    '{{yield (hash comp=(component "baz-bar"))}}'
  );
  registerEmberishCurlyComponent(context.registry, 'baz-bar', null, 'Hello {{arg1}} {{yield}}');

  appendViewFor(
    stripTight`
      {{#foo-bar as |my|}}
        {{#component my.comp}}World!{{/component}} Test
      {{/foo-bar}}
    `
  );

  assertText('Hello World! Test');
});

QUnit.test('component deopt can handle aliased inline components without args', () => {
  registerEmberishCurlyComponent(context.registry, 'foo-bar', null, 'Hello');

  appendViewFor(
    stripTight`
      {{#with (hash comp=(component 'foo-bar')) as |my|}}
        {{my.comp}} World!
      {{/with}}
    `
  );

  assertText('Hello World!');
});

QUnit.test('component deopt can handle higher order inline components without args', () => {
  registerEmberishCurlyComponent(
    context.registry,
    'foo-bar',
    null,
    '{{yield (hash comp=(component "baz-bar"))}}'
  );
  registerEmberishCurlyComponent(context.registry, 'baz-bar', null, 'Hello');

  appendViewFor(
    stripTight`
      {{#foo-bar as |my|}}
        {{my.comp}} World!
      {{/foo-bar}}
    `
  );

  assertText('Hello World!');
});

QUnit.test('component helper can curry arguments', () => {
  class FooBarComponent extends EmberishCurlyComponent {
    static positionalParams = ['one', 'two', 'three', 'four', 'five', 'six'];
  }

  registerEmberishCurlyComponent(
    context.registry,
    'foo-bar',
    FooBarComponent as any,
    stripTight`
    1. [{{one}}]
    2. [{{two}}]
    3. [{{three}}]
    4. [{{four}}]
    5. [{{five}}]
    6. [{{six}}]

    {{yield}}

    a. [{{a}}]
    b. [{{b}}]
    c. [{{c}}]
    d. [{{d}}]
    e. [{{e}}]
    f. [{{f}}]`
  );

  appendViewFor(
    stripTight`
      {{#with (component "foo-bar" "outer 1" "outer 2" a="outer a" b="outer b" c="outer c" e="outer e") as |outer|}}
        {{#with (component outer "inner 1" a="inner a" d="inner d" e="inner e") as |inner|}}
          {{#component inner "invocation 1" "invocation 2" a="invocation a" b="invocation b"}}---{{/component}}
        {{/with}}
      {{/with}}
    `
  );

  assertText(stripTight`
    1. [outer 1]
    2. [outer 2]
    3. [inner 1]
    4. [invocation 1]
    5. [invocation 2]
    6. []

    ---

    a. [invocation a]
    b. [invocation b]
    c. [outer c]
    d. [inner d]
    e. [inner e]
    f. []
  `);
});

QUnit.test('component helper: currying works inline', () => {
  class FooBarComponent extends EmberishCurlyComponent {
    static positionalParams = ['one', 'two', 'three', 'four', 'five', 'six'];
  }

  registerEmberishCurlyComponent(
    context.registry,
    'foo-bar',
    FooBarComponent as any,
    stripTight`
    1. [{{one}}]
    2. [{{two}}]
    3. [{{three}}]
    4. [{{four}}]
    5. [{{five}}]
    6. [{{six}}]
  `
  );

  appendViewFor(
    stripTight`
      {{component (component (component 'foo-bar' foo.first foo.second) 'inner 1') 'invocation 1' 'invocation 2'}}
    `,
    {
      foo: {
        first: 'outer 1',
        second: 'outer 2',
      },
    }
  );

  assertText(stripTight`
    1. [outer 1]
    2. [outer 2]
    3. [inner 1]
    4. [invocation 1]
    5. [invocation 2]
    6. []
  `);
});

module('Emberish Component - ids');

QUnit.test('emberish curly component should have unique IDs', assert => {
  registerEmberishCurlyComponent(context.registry, 'x-curly', null, '');

  appendViewFor(
    stripTight`
      <div>
        {{x-curly}}
        {{x-curly}}
        {{x-curly}}
      </div>`
  );

  let first = assertElement(view.element.firstChild);
  let second = assertElement(first.nextSibling);
  let third = assertElement(second.nextSibling);

  equalsElement(first, 'div', { id: regex(/^ember\d*$/), class: 'ember-view' }, '');
  equalsElement(second, 'div', { id: regex(/^ember\d*$/), class: 'ember-view' }, '');
  equalsElement(third, 'div', { id: regex(/^ember\d*$/), class: 'ember-view' }, '');

  let IDs = dict<number>();

  function markAsSeen(element: SimpleElement) {
    let id = unwrap(elementId(element));
    IDs[id] = (IDs[id] || 0) + 1;
  }

  markAsSeen(assertElement(view.element.childNodes[0]));
  markAsSeen(assertElement(view.element.childNodes[1]));
  markAsSeen(assertElement(view.element.childNodes[2]));

  assert.equal(Object.keys(IDs).length, 3, 'Expected the components to each have a unique IDs');

  for (let id in IDs) {
    assert.equal(IDs[id], 1, `Expected ID ${id} to be unique`);
  }
});

module('Glimmer Component');

let styles = [
  {
    name: 'a div',
    tagName: 'div',
    test: QUnit.test,
  },
  {
    name: 'a web component',
    tagName: 'not-an-ember-component',
    test: QUnit.test,
  },
];

styles.forEach(style => {
  style.test(`NonBlock without attributes replaced with ${style.name}`, assert => {
    registerEmberishGlimmerComponent(
      context.registry,
      'NonBlock',
      null,
      `  <${style.tagName} ...attributes>In layout</${style.tagName}>  `
    );

    appendViewFor('<NonBlock />');

    let node = view.element.firstChild;
    equalsElement(view.element, style.tagName, {}, 'In layout');

    rerender();

    assert.strictEqual(node, view.element.firstChild, 'The inner element has not changed');
    equalsElement(view.element, style.tagName, {}, 'In layout');
  });

  style.test(`NonBlock with attributes replaced with ${style.name}`, function() {
    registerEmberishGlimmerComponent(
      context.registry,
      'NonBlock',
      null,
      `  <${style.tagName} such="{{@stability}}" ...attributes>In layout</${style.tagName}>  `
    );

    appendViewFor('<NonBlock @stability={{stability}} />', { stability: 'stability' });

    let node = view.element;
    equalsElement(node, style.tagName, { such: 'stability' }, 'In layout');

    set(view, 'stability', 'changed!!!');
    rerender();

    assert.strictEqual(
      firstElementChild(node),
      firstElementChild(view.element),
      'The inner element has not changed'
    );
    equalsElement(node, style.tagName, { such: 'changed!!!' }, 'In layout');
  });
});

QUnit.test(`Ensure components can be invoked`, function() {
  registerEmberishGlimmerComponent(context.registry, 'Outer', null, `<Inner></Inner>`);
  registerEmberishGlimmerComponent(context.registry, 'Inner', null, `<div ...attributes>hi!</div>`);

  appendViewFor('<Outer />');
  equalsElement(view.element, 'div', {}, 'hi!');
});

QUnit.test(`Glimmer component with element modifier`, function(assert) {
  registerEmberishGlimmerComponent(context.registry, 'NonBlock', null, `  <div>In layout</div>  `);

  assert.throws(
    () => {
      appendViewFor('<NonBlock {{action}} />');
    },
    new Error('Compile Error: Element modifiers are not allowed in components'),
    'should throw error'
  );
});

QUnit.test('Custom element with element modifier', function(assert) {
  assert.expect(0);

  registerModifier(context.registry, 'foo');

  appendViewFor('<some-custom-element {{foo "foo"}}></some-custom-element>');
});

QUnit.test('Curly component hooks (with attrs)', assert => {
  let instance: NonBlock & HookedComponent | undefined;

  class NonBlock extends EmberishCurlyComponent {
    init() {
      instance = this as any;
    }
  }

  registerEmberishCurlyComponent(
    context.registry,
    'non-block',
    inspectHooks(NonBlock),
    'In layout - someProp: {{@someProp}}'
  );

  appendViewFor('{{non-block someProp=someProp}}', { someProp: 'wycats' });

  assert.ok(instance, 'instance is created');

  if (instance === undefined) {
    return;
  }

  assertFired(instance, 'didReceiveAttrs');
  assertFired(instance, 'willRender');
  assertFired(instance, 'didInsertElement');
  assertFired(instance, 'didRender');

  assertEmberishElement('div', 'In layout - someProp: wycats');

  set(view, 'someProp', 'tomdale');
  rerender();

  assertEmberishElement('div', 'In layout - someProp: tomdale');

  assertFired(instance, 'didReceiveAttrs', 2);
  assertFired(instance, 'willUpdate');
  assertFired(instance, 'willRender', 2);
  assertFired(instance, 'didUpdate');
  assertFired(instance, 'didRender', 2);

  rerender();

  assertEmberishElement('div', 'In layout - someProp: tomdale');

  assertFired(instance, 'didReceiveAttrs', 3);
  assertFired(instance, 'willUpdate', 2);
  assertFired(instance, 'willRender', 3);
  assertFired(instance, 'didUpdate', 2);
  assertFired(instance, 'didRender', 3);
});

QUnit.test('Curly component hooks (attrs as self props)', function() {
  let instance: NonBlock & HookedComponent | undefined;

  class NonBlock extends EmberishCurlyComponent {
    init() {
      instance = this as any;
    }
  }

  registerEmberishCurlyComponent(
    context.registry,
    'non-block',
    inspectHooks(NonBlock),
    'In layout - someProp: {{someProp}}'
  );

  appendViewFor('{{non-block someProp=someProp}}', { someProp: 'wycats' });

  assert.ok(instance, 'instance is created');

  if (instance === undefined) {
    return;
  }

  assertFired(instance, 'didReceiveAttrs');
  assertFired(instance, 'willRender');
  assertFired(instance, 'didInsertElement');
  assertFired(instance, 'didRender');

  assertEmberishElement('div', 'In layout - someProp: wycats');

  set(view, 'someProp', 'tomdale');
  rerender();

  assertEmberishElement('div', 'In layout - someProp: tomdale');

  assertFired(instance, 'didReceiveAttrs', 2);
  assertFired(instance, 'willUpdate');
  assertFired(instance, 'willRender', 2);
  assertFired(instance, 'didUpdate');
  assertFired(instance, 'didRender', 2);

  rerender();

  assertEmberishElement('div', 'In layout - someProp: tomdale');

  assertFired(instance, 'didReceiveAttrs', 3);
  assertFired(instance, 'willUpdate', 2);
  assertFired(instance, 'willRender', 3);
  assertFired(instance, 'didUpdate', 2);
  assertFired(instance, 'didRender', 3);
});

QUnit.test('Setting value attributeBinding to null results in empty string value', function(
  assert
) {
  let instance: InputComponent | undefined;

  class InputComponent extends EmberishCurlyComponent {
    tagName = 'input';
    attributeBindings = ['value'];
    init() {
      instance = this;
    }
  }

  registerEmberishCurlyComponent(
    context.registry,
    'input-component',
    inspectHooks(InputComponent),
    'input component'
  );

  appendViewFor('{{input-component value=someProp}}', { someProp: null });

  assert.ok(instance, 'instance is created');

  if (instance === undefined) {
    return;
  }

  let element: HTMLInputElement = instance.element as HTMLInputElement;

  assert.equal(element.value, '');

  set(view, 'someProp', 'wycats');
  rerender();

  assert.equal(element.value, 'wycats');

  set(view, 'someProp', null);
  rerender();

  assert.equal(element.value, '');
});

QUnit.test('Setting class attributeBinding does not clobber ember-view', assert => {
  let instance: FooBarComponent | undefined;

  class FooBarComponent extends EmberishCurlyComponent {
    attributeBindings = ['class'];
    init() {
      instance = this;
    }
  }

  registerEmberishCurlyComponent(context.registry, 'foo-bar', FooBarComponent, 'FOO BAR');

  appendViewFor('{{foo-bar class=classes}}', { classes: 'foo bar' });

  assert.ok(instance, 'instance is created');

  if (instance === undefined) {
    return;
  }

  assertEmberishElement('div', { class: classes('ember-view foo bar') }, 'FOO BAR');

  rerender();

  assertEmberishElement('div', { class: classes('ember-view foo bar') }, 'FOO BAR');

  set(view, 'classes', 'foo bar baz');
  rerender();

  assertEmberishElement('div', { class: classes('ember-view foo bar baz') }, 'FOO BAR');

  set(view, 'classes', 'foo bar');
  rerender();

  assertEmberishElement('div', { class: classes('ember-view foo bar') }, 'FOO BAR');
});

QUnit.test('Curly component hooks (force recompute)', assert => {
  let instance: NonBlock & HookedComponent | undefined;

  class NonBlock extends EmberishCurlyComponent {
    init() {
      instance = this as any;
    }
  }

  registerEmberishCurlyComponent(
    context.registry,
    'non-block',
    inspectHooks(NonBlock),
    'In layout - someProp: {{@someProp}}'
  );

  appendViewFor('{{non-block someProp="wycats"}}');

  assert.ok(instance, 'instance is created');

  if (instance === undefined) {
    return;
  }

  assertFired(instance, 'didReceiveAttrs', 1);
  assertFired(instance, 'willRender', 1);
  assertFired(instance, 'didInsertElement', 1);
  assertFired(instance, 'didRender', 1);

  assertEmberishElement('div', 'In layout - someProp: wycats');

  rerender();

  assertEmberishElement('div', 'In layout - someProp: wycats');

  assertFired(instance, 'didReceiveAttrs', 1);
  assertFired(instance, 'willRender', 1);
  assertFired(instance, 'didRender', 1);

  instance.recompute();
  rerender();

  assertEmberishElement('div', 'In layout - someProp: wycats');

  assertFired(instance, 'didReceiveAttrs', 2);
  assertFired(instance, 'willUpdate', 1);
  assertFired(instance, 'willRender', 2);
  assertFired(instance, 'didUpdate', 1);
  assertFired(instance, 'didRender', 2);
});

QUnit.test('Glimmer component hooks', assert => {
  let instance: NonBlock & HookedComponent | undefined;

  class NonBlock extends EmberishGlimmerComponent {
    constructor(args: EmberishGlimmerArgs) {
      super(args);
      instance = this as any;
    }
  }

  registerEmberishGlimmerComponent(
    context.registry,
    'NonBlock',
    inspectHooks(NonBlock as any),
    '<div ...attributes>In layout - someProp: {{@someProp}}</div>'
  );

  appendViewFor('<NonBlock @someProp={{someProp}} />', { someProp: 'wycats' });

  assert.ok(instance, 'instance is created');

  if (instance === undefined) {
    return;
  }

  assertFired(instance, 'didReceiveAttrs');
  assertFired(instance, 'willRender');
  assertFired(instance, 'didInsertElement');
  assertFired(instance, 'didRender');

  assertElementShape(view.element, 'div', 'In layout - someProp: wycats');

  set(view, 'someProp', 'tomdale');
  rerender();

  assertElementShape(view.element, 'div', 'In layout - someProp: tomdale');

  assertFired(instance, 'didReceiveAttrs', 2);
  assertFired(instance, 'willUpdate');
  assertFired(instance, 'willRender', 2);
  assertFired(instance, 'didUpdate');
  assertFired(instance, 'didRender', 2);

  rerender();

  assertElementShape(view.element, 'div', 'In layout - someProp: tomdale');

  assertFired(instance, 'didReceiveAttrs', 3);
  assertFired(instance, 'willUpdate', 2);
  assertFired(instance, 'willRender', 3);
  assertFired(instance, 'didUpdate', 2);
  assertFired(instance, 'didRender', 3);
});

QUnit.test('Glimmer component hooks (force recompute)', assert => {
  let instance: NonBlock & HookedComponent | undefined;

  class NonBlock extends EmberishGlimmerComponent {
    constructor(args: EmberishGlimmerArgs) {
      super(args);
      instance = this as any;
    }
  }

  registerEmberishGlimmerComponent(
    context.registry,
    'NonBlock',
    inspectHooks(NonBlock as any),
    '<div ...attributes>In layout - someProp: {{@someProp}}</div>'
  );

  appendViewFor('<NonBlock @someProp="wycats" />');

  assert.ok(instance, 'instance is created');

  if (instance === undefined) {
    return;
  }

  assertFired(instance, 'didReceiveAttrs', 1);
  assertFired(instance, 'willRender', 1);
  assertFired(instance, 'didInsertElement', 1);
  assertFired(instance, 'didRender', 1);

  assertElementShape(view.element, 'div', 'In layout - someProp: wycats');

  rerender();

  assertElementShape(view.element, 'div', 'In layout - someProp: wycats');

  assertFired(instance, 'didReceiveAttrs', 1);
  assertFired(instance, 'willRender', 1);
  assertFired(instance, 'didRender', 1);

  instance.recompute();
  rerender();

  assertElementShape(view.element, 'div', 'In layout - someProp: wycats');

  assertFired(instance, 'didReceiveAttrs', 2);
  assertFired(instance, 'willUpdate', 1);
  assertFired(instance, 'willRender', 2);
  assertFired(instance, 'didUpdate', 1);
  assertFired(instance, 'didRender', 2);
});

module('Teardown');

QUnit.test('curly components are destroyed', function(assert) {
  let destroyed = 0;

  class DestroyMeComponent extends EmberishCurlyComponent {
    destroy() {
      super.destroy();
      destroyed++;
    }
  }

  registerEmberishCurlyComponent(
    context.registry,
    'destroy-me',
    DestroyMeComponent as any,
    'destroy me!'
  );

  appendViewFor(`{{#if cond}}{{destroy-me}}{{/if}}`, { cond: true });

  assert.strictEqual(destroyed, 0, 'destroy should not be called');

  view.rerender({ cond: false });

  assert.strictEqual(destroyed, 1, 'destroy should be called exactly one');
});

QUnit.test('glimmer components are destroyed', function(assert) {
  let destroyed = 0;

  class DestroyMeComponent extends EmberishCurlyComponent {
    destroy() {
      super.destroy();
      destroyed++;
    }
  }

  registerEmberishGlimmerComponent(
    context.registry,
    'DestroyMe',
    DestroyMeComponent as any,
    '<div ...attributes>destroy me!</div>'
  );

  appendViewFor(`{{#if cond}}<DestroyMe />{{/if}}`, { cond: true });

  assert.strictEqual(destroyed, 0, 'destroy should not be called');

  view.rerender({ cond: false });

  assert.strictEqual(destroyed, 1, 'destroy should be called exactly one');
});

QUnit.test('component helpers component are destroyed', function(assert) {
  let destroyed = 0;

  class DestroyMeComponent extends EmberishCurlyComponent {
    destroy() {
      super.destroy();
      destroyed++;
    }
  }

  registerEmberishCurlyComponent(
    context.registry,
    'destroy-me',
    DestroyMeComponent as any,
    'destroy me!'
  );

  class AnotherComponent extends EmberishCurlyComponent {}

  registerEmberishCurlyComponent(
    context.registry,
    'another-component',
    AnotherComponent as any,
    'another thing!'
  );

  appendViewFor(`{{component componentName}}`, { componentName: 'destroy-me' });

  assert.strictEqual(destroyed, 0, 'destroy should not be called');

  view.rerender({ componentName: 'another-component' });

  assert.strictEqual(destroyed, 1, 'destroy should be called exactly one');
});

QUnit.test('components inside a list are destroyed', function(assert) {
  let destroyed: unknown[] = [];

  class DestroyMeComponent extends EmberishCurlyComponent {
    destroy() {
      super.destroy();
      destroyed.push(this.attrs.item);
    }
  }

  registerEmberishGlimmerComponent(
    context.registry,
    'DestroyMe',
    DestroyMeComponent as any,
    '<div>destroy me!</div>'
  );

  appendViewFor(`{{#each list key='@primitive' as |item|}}<DestroyMe @item={{item}} />{{/each}}`, {
    list: [1, 2, 3, 4, 5],
  });

  assert.strictEqual(destroyed.length, 0, 'destroy should not be called');

  view.rerender({ list: [1, 2, 3] });

  assert.deepEqual(destroyed, [4, 5], 'destroy should be called exactly twice');

  view.rerender({ list: [3, 2, 1] });

  assert.deepEqual(destroyed, [4, 5], 'destroy should be called exactly twice');

  view.rerender({ list: [] });

  assert.deepEqual(destroyed, [4, 5, 1, 2, 3], 'destroy should be called for each item');
});

QUnit.test('components inside a list are destroyed (when key is @identity)', function(assert) {
  let destroyed: unknown[] = [];

  class DestroyMeComponent extends EmberishCurlyComponent {
    destroy() {
      super.destroy();
      destroyed.push(this.attrs.item);
    }
  }

  registerEmberishGlimmerComponent(
    context.registry,
    'DestroyMe',
    DestroyMeComponent as any,
    '<div>destroy me!</div>'
  );

  let val1 = { val: 1 };
  let val2 = { val: 2 };
  let val3 = { val: 3 };
  let val4 = { val: 4 };
  let val5 = { val: 5 };

  appendViewFor(`{{#each list key='@identity' as |item|}}<DestroyMe @item={{item}} />{{/each}}`, {
    list: [val1, val2, val3, val4, val5],
  });

  assert.strictEqual(destroyed.length, 0, 'destroy should not be called');

  view.rerender({ list: [val1, val2, val3] });

  assert.deepEqual(destroyed, [val4, val5], 'destroy should be called exactly twice');

  view.rerender({ list: [val3, val2, val1] });

  assert.deepEqual(destroyed, [val4, val5], 'destroy should be called exactly twice');

  view.rerender({ list: [] });

  assert.deepEqual(
    destroyed,
    [val4, val5, val1, val2, val3],
    'destroy should be called for each item'
  );
});

QUnit.test('components that are "destroyed twice" are destroyed once', function(assert) {
  let destroyed: string[] = [];

  class DestroyMeComponent extends EmberishCurlyComponent {
    destroy() {
      super.destroy();
      destroyed.push(this.attrs.from as any);
    }
  }

  class DestroyMe2Component extends EmberishCurlyComponent {
    destroy() {
      super.destroy();
      destroyed.push(this.attrs.from as any);
    }
  }

  registerEmberishCurlyComponent(
    context.registry,
    'destroy-me',
    DestroyMeComponent as any,
    '{{#if @cond}}{{destroy-me-inner from="inner"}}{{/if}}'
  );
  registerEmberishCurlyComponent(
    context.registry,
    'destroy-me-inner',
    DestroyMe2Component as any,
    'inner'
  );

  appendViewFor(`{{#if cond}}{{destroy-me from="root" cond=child.cond}}{{/if}}`, {
    cond: true,
    child: { cond: true },
  });

  assert.deepEqual(destroyed, [], 'destroy should not be called');

  view.rerender({ cond: false, child: { cond: false } });

  assert.deepEqual(
    destroyed,
    ['root', 'inner'],
    'destroy should be called exactly once per component'
  );
});

QUnit.test('deeply nested destructions', function(assert) {
  let destroyed: string[] = [];

  class DestroyMe1Component extends EmberishCurlyComponent {
    destroy() {
      super.destroy();
      destroyed.push(`destroy-me1: ${this.attrs.item}`);
    }
  }

  class DestroyMe2Component extends EmberishCurlyComponent {
    destroy() {
      super.destroy();
      destroyed.push(`destroy-me2: ${this.attrs.from} - ${this.attrs.item}`);
    }
  }

  registerEmberishGlimmerComponent(
    context.registry,
    'DestroyMe1',
    DestroyMe1Component as any,
    '<div>{{#destroy-me2 item=@item from="destroy-me1"}}{{yield}}{{/destroy-me2}}</div>'
  );
  registerEmberishCurlyComponent(
    context.registry,
    'destroy-me2',
    DestroyMe2Component as any,
    'Destroy me! {{yield}}'
  );

  appendViewFor(
    `{{#each list key='@primitive' as |item|}}<DestroyMe1 @item={{item}}>{{#destroy-me2 from="root" item=item}}{{/destroy-me2}}</DestroyMe1>{{/each}}`,
    { list: [1, 2, 3, 4, 5] }
  );

  assert.strictEqual(destroyed.length, 0, 'destroy should not be called');

  view.rerender({ list: [1, 2, 3] });

  assert.deepEqual(
    destroyed,
    [
      'destroy-me1: 4',
      'destroy-me2: destroy-me1 - 4',
      'destroy-me2: root - 4',
      'destroy-me1: 5',
      'destroy-me2: destroy-me1 - 5',
      'destroy-me2: root - 5',
    ],
    'destroy should be called exactly twice'
  );

  destroyed = [];

  view.rerender({ list: [3, 2, 1] });

  assert.deepEqual(destroyed, [], 'destroy should be called exactly twice');

  view.rerender({ list: [] });

  assert.deepEqual(
    destroyed,
    [
      'destroy-me1: 1',
      'destroy-me2: destroy-me1 - 1',
      'destroy-me2: root - 1',
      'destroy-me1: 2',
      'destroy-me2: destroy-me1 - 2',
      'destroy-me2: root - 2',
      'destroy-me1: 3',
      'destroy-me2: destroy-me1 - 3',
      'destroy-me2: root - 3',
    ],
    'destroy should be called for each item'
  );
});

QUnit.test('components inside the root are destroyed when the render result is destroyed', function(
  assert
) {
  let glimmerDestroyed = false;
  let curlyDestroyed = false;

  class DestroyMe1Component extends EmberishGlimmerComponent {
    destroy(this: EmberishGlimmerComponent) {
      super.destroy();
      glimmerDestroyed = true;
    }
  }

  class DestroyMe2Component extends EmberishCurlyComponent {
    destroy(this: EmberishCurlyComponent) {
      super.destroy();
      curlyDestroyed = true;
    }
  }

  registerEmberishGlimmerComponent(
    context.registry,
    'DestroyMe1',
    DestroyMe1Component as any,
    '<div>Destry me!</div>'
  );
  registerEmberishCurlyComponent(
    context.registry,
    'destroy-me2',
    DestroyMe2Component as any,
    'Destroy me too!'
  );

  appendViewFor(`<DestroyMe1 id="destroy-me1"/>{{destroy-me2 id="destroy-me2"}}`);

  assert.strictEqual(glimmerDestroyed, false, 'the glimmer component should not be destroyed');
  assert.strictEqual(curlyDestroyed, false, 'the curly component should not be destroyed');

  view.destroy();

  assert.strictEqual(glimmerDestroyed, true, 'the glimmer component destroy hook was called');
  assert.strictEqual(curlyDestroyed, true, 'the glimmer component destroy hook was called');

  assert.strictEqual(
    document.querySelectorAll('#destroy-me1').length,
    0,
    'component DOM node was removed from DOM'
  );
  assert.strictEqual(
    document.querySelectorAll('#destroy-me2').length,
    0,
    'component DOM node was removed from DOM'
  );

  assert.strictEqual(
    document.querySelector('#qunit-fixture')!.childElementCount,
    0,
    'root view was removed from DOM'
  );
});

QUnit.test('tagless components render properly', () => {
  class FooBar extends BasicComponent {}

  registerStaticTaglessComponent(
    context.registry,
    'foo-bar',
    FooBar,
    `Michael Jordan says "Go Tagless"`
  );

  appendViewFor(`{{foo-bar}}`);
  assertAppended('Michael Jordan says "Go Tagless"');

  rerender();

  assertAppended('Michael Jordan says "Go Tagless"');
});

module('late bound layout');

QUnit.test('can bind the layout late', () => {
  class FooBar extends EmberishCurlyComponent {
    layout = registerTemplate(context.registry, 'my-dynamic-layout', 'Swap - {{yield}}');
  }

  registerEmberishCurlyComponent(context.registry, 'foo-bar', FooBar, null);

  appendViewFor('{{#foo-bar}}YIELD{{/foo-bar}}');

  equalsElement(
    view.element,
    'div',
    {
      class: classes('ember-view'),
      id: regex(/^ember\d*$/),
    },
    'Swap - YIELD'
  );
});

module('appendable components');

QUnit.test('it does not work on optimized appends', () => {
  class FooBar extends EmberishCurlyComponent {}

  registerEmberishCurlyComponent(context.registry, 'foo-bar', FooBar, 'foo bar');

  let definition = componentHelper(context.resolver, context.registry, 'foo-bar');

  appendViewFor('{{foo}}', { foo: definition });

  assertEmberishElement('div', {}, 'foo bar');

  rerender();

  assertEmberishElement('div', {}, 'foo bar');

  view.rerender({ foo: 'foo' });

  assertAppended('foo');

  view.rerender({ foo: definition });

  assertEmberishElement('div', {}, 'foo bar');
});

QUnit.test('it works on unoptimized appends (dot paths)', () => {
  class FooBar extends EmberishCurlyComponent {}

  registerEmberishCurlyComponent(context.registry, 'foo-bar', FooBar, 'foo bar');

  let definition = componentHelper(context.resolver, context.registry, 'foo-bar');

  appendViewFor('{{foo.bar}}', { foo: { bar: definition } });

  assertEmberishElement('div', {}, 'foo bar');

  rerender();

  assertEmberishElement('div', {}, 'foo bar');

  view.rerender({ foo: { bar: 'lol' } });

  assertAppended('lol');

  rerender();

  assertAppended('lol');

  view.rerender({ foo: { bar: 'omg' } });

  assertAppended('omg');

  view.rerender({ foo: { bar: definition } });

  assertEmberishElement('div', {}, 'foo bar');
});

QUnit.test('it works on unoptimized appends (this paths)', () => {
  class FooBar extends EmberishCurlyComponent {}

  registerEmberishCurlyComponent(context.registry, 'foo-bar', FooBar, 'foo bar');

  let definition = componentHelper(context.resolver, context.registry, 'foo-bar');

  appendViewFor('{{this.foo}}', { foo: definition });

  assertEmberishElement('div', {}, 'foo bar');

  rerender();

  assertEmberishElement('div', {}, 'foo bar');

  view.rerender({ foo: 'lol' });

  assertAppended('lol');

  rerender();

  assertAppended('lol');

  view.rerender({ foo: 'omg' });

  assertAppended('omg');

  view.rerender({ foo: definition });

  assertEmberishElement('div', {}, 'foo bar');
});

QUnit.test('it works on unoptimized appends when initially not a component (dot paths)', () => {
  class FooBar extends EmberishCurlyComponent {}

  registerEmberishCurlyComponent(context.registry, 'foo-bar', FooBar, 'foo bar');

  let definition = componentHelper(context.resolver, context.registry, 'foo-bar');

  appendViewFor('{{foo.bar}}', { foo: { bar: 'lol' } });

  assertAppended('lol');

  rerender();

  assertAppended('lol');

  view.rerender({ foo: { bar: definition } });

  assertEmberishElement('div', {}, 'foo bar');

  rerender();

  assertEmberishElement('div', {}, 'foo bar');

  view.rerender({ foo: { bar: 'lol' } });

  assertAppended('lol');
});

QUnit.test('it works on unoptimized appends when initially not a component (this paths)', () => {
  class FooBar extends EmberishCurlyComponent {}

  registerEmberishCurlyComponent(context.registry, 'foo-bar', FooBar, 'foo bar');

  let definition = componentHelper(context.resolver, context.registry, 'foo-bar');

  appendViewFor('{{this.foo}}', { foo: 'lol' });

  assertAppended('lol');

  rerender();

  assertAppended('lol');

  view.rerender({ foo: definition });

  assertEmberishElement('div', {}, 'foo bar');

  rerender();

  assertEmberishElement('div', {}, 'foo bar');

  view.rerender({ foo: 'lol' });

  assertAppended('lol');
});

module('bounds tracking');

QUnit.test('it works for wrapped (curly) components', function(assert) {
  let instance: FooBar | undefined;

  class FooBar extends EmberishCurlyComponent {
    tagName = 'span';

    constructor() {
      super();
      instance = this;
    }
  }

  registerEmberishCurlyComponent(context.registry, 'foo-bar', FooBar, 'foo bar');

  appendViewFor('zomg {{foo-bar}} wow');

  assert.ok(instance, 'instance is created');

  if (instance === undefined) {
    return;
  }

  assertEmberishElement('span', {}, 'foo bar');

  assert.equal(instance.bounds.parentElement(), document.querySelector('#qunit-fixture'));
  assert.equal(instance.bounds.firstNode(), instance.element);
  assert.equal(instance.bounds.lastNode(), instance.element);
});

QUnit.test('it works for tagless components', function(assert) {
  let instance: FooBar | undefined;

  class FooBar extends EmberishCurlyComponent {
    tagName = '';

    constructor() {
      super();
      instance = this;
    }
  }

  registerEmberishCurlyComponent(
    context.registry,
    'foo-bar',
    FooBar,
    '<span id="first-node">foo</span> <span id="before-last-node">bar</span>!'
  );

  appendViewFor('zomg {{foo-bar}} wow');

  assert.ok(instance, 'instance is created');

  if (instance === undefined) {
    return;
  }

  assertAppended(
    'zomg <span id="first-node">foo</span> <span id="before-last-node">bar</span>! wow'
  );

  assert.equal(instance.bounds.parentElement(), document.querySelector('#qunit-fixture'));
  assert.equal(instance.bounds.firstNode(), document.querySelector('#first-node'));
  assert.equal(
    instance.bounds.lastNode(),
    document.querySelector('#before-last-node')!.nextSibling
  );
});

QUnit.test('it works for unwrapped components', function(assert) {
  let instance: FooBar | undefined;

  class FooBar extends EmberishGlimmerComponent {
    constructor(args: EmberishGlimmerArgs) {
      super(args);
      instance = this;
    }
  }

  registerEmberishGlimmerComponent(
    context.registry,
    'FooBar',
    FooBar,
    '<!-- ohhh --><span id="ralph-the-wrench" ...attributes>foo bar!</span>'
  );

  appendViewFor('zomg <FooBar /> wow');

  assert.ok(instance, 'instance is created');

  if (instance === undefined) {
    return;
  }

  assertElementShape(view.element, 'span', { id: 'ralph-the-wrench' }, 'foo bar!');

  let ralphy = document.getElementById('ralph-the-wrench')!;

  assert.equal(instance.bounds.parentElement(), document.querySelector('#qunit-fixture'));
  assert.equal(instance.bounds.firstNode(), ralphy.previousSibling);
  assert.equal(instance.bounds.lastNode(), ralphy);
});
