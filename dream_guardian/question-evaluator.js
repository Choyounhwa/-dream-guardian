/* Restricted evaluator for the arithmetic CSV format. It accepts only the documented
   variables, operators, literals, and helper functions; CSV content cannot run code. */
(function(root){
  const FUNCTIONS={
    rand:(a,b)=>Math.floor(Math.random()*(b-a+1))+a,
    pick:(...values)=>values[Math.floor(Math.random()*values.length)],
    gcd:(a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b){const next=a%b;a=b;b=next;}return a;},
    factorial:n=>{if(!Number.isInteger(n)||n<0||n>12)throw Error('Invalid factorial');let out=1;for(let i=2;i<=n;i++)out*=i;return out;},
    sup:n=>String(n).split('').map(d=>({'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'}[d]||d)).join(''),
    repeatMul:(n,count)=>Array(Math.max(1,count)).fill(n).join(' × '),
    repeatAdd:(n,count)=>Array(Math.max(1,count)).fill(n).join(' + '),
    String:value=>String(value),
    'Math.abs':Math.abs
  };
  const OPERATORS=['===','!==','>=','<=','==','!=','**','+','-','*','/','%','>','<'];
  function tokenize(source){
    const tokens=[];let i=0;
    while(i<source.length){
      if(/\s/.test(source[i])){i++;continue;}
      if(source[i]==="'"){let value='';i++;while(i<source.length&&source[i]!=="'"){if(source[i]==='\\'&&i+1<source.length)i++;value+=source[i++];}if(source[i++]!=="'")throw Error('Unclosed string');tokens.push({type:'string',value});continue;}
      const number=source.slice(i).match(/^(?:\d+\.?(?:\d*)?|\.\d+)/);
      if(number){tokens.push({type:'number',value:Number(number[0])});i+=number[0].length;continue;}
      const name=source.slice(i).match(/^[A-Za-z][A-Za-z0-9_.]*/);
      if(name){tokens.push({type:'name',value:name[0]});i+=name[0].length;continue;}
      const op=OPERATORS.find(value=>source.startsWith(value,i));
      if(op){tokens.push({type:'operator',value:op});i+=op.length;continue;}
      if('(),?:'.includes(source[i]))tokens.push({type:source[i],value:source[i++]});
      else throw Error('Unsupported token');
    }
    tokens.push({type:'end'});return tokens;
  }
  function evaluate(source,variables={}){
    const tokens=tokenize(String(source)),precedence={'==':1,'===':1,'!=':1,'!==':1,'>':2,'<':2,'>=':2,'<=':2,'+':3,'-':3,'*':4,'/':4,'%':4,'**':5};let index=0;
    const peek=()=>tokens[index],take=type=>{const token=tokens[index++];if(token.type!==type)throw Error(`Expected ${type}`);return token;};
    function primary(enabled){const token=tokens[index++];if(token.type==='number'||token.type==='string')return token.value;if(token.type==='name'){
      if(peek().type==='('){if(!Object.prototype.hasOwnProperty.call(FUNCTIONS,token.value))throw Error('Unsupported function');take('(');const args=[];if(peek().type!==')'){do{args.push(expression(0,enabled));if(peek().type!==',')break;take(',');}while(true);}take(')');return enabled?FUNCTIONS[token.value](...args):undefined;}
      if(Object.prototype.hasOwnProperty.call(variables,token.value))return variables[token.value];
      throw Error('Unsupported variable');
    }if(token.type==='('){const value=expression(0,enabled);take(')');return value;}if(token.type==='operator'&&(token.value==='+'||token.value==='-')){const value=primary(enabled);return enabled?(token.value==='-'?-value:+value):undefined;}throw Error('Expected value');}
    function apply(operator,a,b){return ({'+':()=>a+b,'-':()=>a-b,'*':()=>a*b,'/':()=>a/b,'%':()=>a%b,'**':()=>a**b,'>':()=>a>b,'<':()=>a<b,'>=':()=>a>=b,'<=':()=>a<=b,'==':()=>a==b,'===':()=>a===b,'!=':()=>a!=b,'!==':()=>a!==b}[operator])();}
    function expression(min,enabled=true){let left=primary(enabled);while(peek().type==='operator'&&precedence[peek().value]>=min){const op=tokens[index++].value;const right=expression(precedence[op]+(op==='**'?0:1),enabled);left=enabled?apply(op,left,right):undefined;}if(min===0&&peek().type==='?'){take('?');const yes=expression(0,enabled&&!!left);take(':');const no=expression(0,enabled&&!left);left=enabled?(left?yes:no):undefined;}return left;}
    const value=expression(0,true);if(peek().type!=='end')throw Error('Unexpected expression');return value;
  }
  const api={evaluate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.QuestionEvaluator=api;
})(typeof globalThis!=='undefined'?globalThis:window);
