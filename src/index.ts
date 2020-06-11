import CONFIG from '../config.json'

function foo(): void {
  console.log('Hello, world')
  console.log('apiKey:', CONFIG.apiKey)
}

foo()
